import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 店舗データ（仮の住所・電話番号、本番前に差し替え）
const STORES = [
  {
    slug: 'otakanomori',
    prefecture: '千葉県',
    city: '流山市',
    name: '流山おおたかの森整骨院',
    address: '千葉県流山市おおたかの森南 1-1-1',
    phone: '04-7100-0000',
    displayOrder: 1,
    beds: 4,
    // 基本シフトは平日のみ出勤のデフォルト（0=日 ... 6=土）。土日も出る人は配列に追加する。
    practitioners: [
      { name: '田中 健太', gender: 'MALE', baseShiftDays: [1, 2, 3, 4, 5, 6] },
      { name: '佐藤 美咲', gender: 'FEMALE', baseShiftDays: [1, 2, 3, 4, 5, 0] },
    ],
  },
];

// 共通メニュー（storeId IS NULL で投入。全店舗で自動利用可能）
const COMMON_MENUS = [
  {
    name: '全身整体 30 分',
    description: '肩・腰・骨盤の主要なゆがみを 30 分でスピーディに調整。お仕事帰りや昼休みのリフレッシュにおすすめです。',
    durationMinutes: 30,
    priceJpy: 4000,
    displayOrder: 1,
  },
  {
    name: '全身整体 60 分',
    description: '全身をじっくり整えるスタンダードコース。慢性的な肩こり・腰痛・自律神経の乱れにお悩みの方に。',
    durationMinutes: 60,
    priceJpy: 7000,
    displayOrder: 2,
  },
  {
    name: '部分整体（肩・腰） 30 分',
    description: '気になる部位をピンポイントで集中ケア。デスクワークによる肩こり・ぎっくり腰の予防に。',
    durationMinutes: 30,
    priceJpy: 3500,
    displayOrder: 3,
  },
  {
    name: '骨盤矯正 60 分',
    description: '産後・反り腰・猫背でお悩みの方へ。骨盤を中心に下半身のバランスを根本から整えます。',
    durationMinutes: 60,
    priceJpy: 8000,
    displayOrder: 4,
  },
  {
    name: 'マッサージ 60 分',
    description: '筋肉のこり・疲労を全身からじっくりほぐす、リラクゼーション中心のコース。',
    durationMinutes: 60,
    priceJpy: 6000,
    displayOrder: 5,
  },
];

// 店舗特別メニュー（storeId 紐付け。slug で店舗を引いて差し込む）
// オープン記念キャンペーンなど期間限定メニューは availableUntil を入れる。
const SPECIAL_MENUS = {
  otakanomori: [
    {
      name: 'ヘッドスパ 30 分',
      description: '頭皮と首まわりを丁寧にほぐす整骨院ならではの特別メニュー。眼精疲労・PC 作業による頭痛・寝つきの悪さが気になる方に。',
      durationMinutes: 30,
      priceJpy: 3800,
      displayOrder: 1,
    },
    {
      name: 'スポーツケア 60 分',
      description: 'ランナー・ジム通いの方向け。筋膜リリースとストレッチを組み合わせた競技後・トレーニング後のリカバリーコース。',
      durationMinutes: 60,
      priceJpy: 7500,
      displayOrder: 2,
    },
    {
      name: 'マタニティ整体 40 分',
      description: '妊娠中の腰痛・むくみ・恥骨痛をやさしくケア。妊娠周期に合わせて専用クッションを使用、専門研修を受けた施術者が担当します。',
      durationMinutes: 40,
      priceJpy: 5500,
      displayOrder: 3,
    },
    {
      name: 'オープン記念キャンペーン 全身整体 60 分',
      description: '【期間限定】流山おおたかの森店オープンを記念した特別価格コース。通常 ¥7,000 のところを ¥5,000 でご提供。お一人さま 1 回限り。',
      durationMinutes: 60,
      priceJpy: 5000,
      displayOrder: 4,
      availableUntil: '2026-06-30',
    },
  ],
};

// 営業時間レンジ(両店共通)
// 1 日に複数レンジを持てる。中抜け休憩は 2 つのレンジで表現。
// 月-金: 9:30-12:30 + 15:00-20:30, 土日: 9:30-12:30 + 15:00-18:00
const BUSINESS_HOUR_RANGES = [
  // 日
  { dayOfWeek: 0, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 0, startTime: '15:00', endTime: '18:00' },
  // 月
  { dayOfWeek: 1, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 1, startTime: '15:00', endTime: '20:30' },
  // 火
  { dayOfWeek: 2, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 2, startTime: '15:00', endTime: '20:30' },
  // 水
  { dayOfWeek: 3, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 3, startTime: '15:00', endTime: '20:30' },
  // 木
  { dayOfWeek: 4, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 4, startTime: '15:00', endTime: '20:30' },
  // 金
  { dayOfWeek: 5, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 5, startTime: '15:00', endTime: '20:30' },
  // 土
  { dayOfWeek: 6, startTime: '09:30', endTime: '12:30' },
  { dayOfWeek: 6, startTime: '15:00', endTime: '18:00' },
];

// 年末年始の休業日(両店共通)
const HOLIDAYS = [
  { date: '2026-12-29', note: '年末年始' },
  { date: '2026-12-30', note: '年末年始' },
  { date: '2026-12-31', note: '年末年始' },
  { date: '2027-01-01', note: '年末年始' },
  { date: '2027-01-02', note: '年末年始' },
  { date: '2027-01-03', note: '年末年始' },
];

// 国民の祝日(2026-2027)
// 2026 春分: 3/20、秋分: 9/23(2025年に閣議決定済)
// 2027 春分: 3/21、秋分: 9/23(計算値、本番前に最新の閣議決定で再確認)
const PUBLIC_HOLIDAYS = [
  // 2026
  { date: '2026-01-01', name: '元日' },
  { date: '2026-01-12', name: '成人の日' },
  { date: '2026-02-11', name: '建国記念の日' },
  { date: '2026-02-23', name: '天皇誕生日' },
  { date: '2026-03-20', name: '春分の日' },
  { date: '2026-04-29', name: '昭和の日' },
  { date: '2026-05-03', name: '憲法記念日' },
  { date: '2026-05-04', name: 'みどりの日' },
  { date: '2026-05-05', name: 'こどもの日' },
  { date: '2026-05-06', name: '振替休日' },
  { date: '2026-07-20', name: '海の日' },
  { date: '2026-08-11', name: '山の日' },
  { date: '2026-09-21', name: '敬老の日' },
  { date: '2026-09-22', name: '国民の休日' },
  { date: '2026-09-23', name: '秋分の日' },
  { date: '2026-10-12', name: 'スポーツの日' },
  { date: '2026-11-03', name: '文化の日' },
  { date: '2026-11-23', name: '勤労感謝の日' },
  // 2027
  { date: '2027-01-01', name: '元日' },
  { date: '2027-01-11', name: '成人の日' },
  { date: '2027-02-11', name: '建国記念の日' },
  { date: '2027-02-23', name: '天皇誕生日' },
  { date: '2027-03-21', name: '春分の日' },
  { date: '2027-03-22', name: '振替休日' },
  { date: '2027-04-29', name: '昭和の日' },
  { date: '2027-05-03', name: '憲法記念日' },
  { date: '2027-05-04', name: 'みどりの日' },
  { date: '2027-05-05', name: 'こどもの日' },
  { date: '2027-07-19', name: '海の日' },
  { date: '2027-08-11', name: '山の日' },
  { date: '2027-09-20', name: '敬老の日' },
  { date: '2027-09-23', name: '秋分の日' },
  { date: '2027-10-11', name: 'スポーツの日' },
  { date: '2027-11-03', name: '文化の日' },
  { date: '2027-11-23', name: '勤労感謝の日' },
];

async function main() {
  console.log('🧹 既存データをクリーンアップ...');
  // 削除順序は依存関係の逆(子→親)
  await prisma.voucherUsage.deleteMany();
  await prisma.reservationHistory.deleteMany();
  await prisma.productSale.deleteMany();
  await prisma.customerVoucher.deleteMany();
  await prisma.product.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.emailChangeToken.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.closure.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.login.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.store.deleteMany();

  console.log('🏥 店舗・ベッド・施術者・営業時間・店休日を投入...');
  for (const s of STORES) {
    const store = await prisma.store.create({
      data: {
        slug: s.slug,
        prefecture: s.prefecture,
        city: s.city,
        name: s.name,
        address: s.address,
        phone: s.phone,
        displayOrder: s.displayOrder,
      },
    });

    for (let i = 1; i <= s.beds; i++) {
      await prisma.bed.create({
        data: { storeId: store.id, name: `${i}番ベッド`, displayOrder: i },
      });
    }

    for (let i = 0; i < s.practitioners.length; i++) {
      const p = s.practitioners[i];
      await prisma.staff.create({
        data: {
          storeId: store.id,
          name: p.name,
          gender: p.gender,
          baseShiftDays: p.baseShiftDays,
          displayOrder: i + 1,
          assignOrder: i + 1,
        },
      });
    }

    for (const bh of BUSINESS_HOUR_RANGES) {
      await prisma.businessHour.create({ data: { storeId: store.id, ...bh } });
    }

    for (const h of HOLIDAYS) {
      await prisma.holiday.create({
        data: { storeId: store.id, date: new Date(h.date), note: h.note },
      });
    }
  }

  console.log('📋 共通メニュー（全店舗で利用可能）を投入...');
  for (const m of COMMON_MENUS) {
    await prisma.menu.create({ data: { ...m, storeId: null } });
  }

  console.log('🎁 店舗特別メニューを投入...');
  for (const [slug, menus] of Object.entries(SPECIAL_MENUS)) {
    const store = await prisma.store.findUnique({ where: { slug } });
    if (!store) {
      console.warn(`  ⚠️  ${slug} の店舗が見つかりませんでした(スキップ)`);
      continue;
    }
    for (const m of menus) {
      await prisma.menu.create({
        data: {
          ...m,
          storeId: store.id,
          availableFrom: m.availableFrom ? new Date(m.availableFrom) : null,
          availableUntil: m.availableUntil ? new Date(m.availableUntil) : null,
        },
      });
    }
  }

  console.log('🎌 国民の祝日(2026-2027)を投入...');
  for (const ph of PUBLIC_HOLIDAYS) {
    await prisma.publicHoliday.create({
      data: { date: new Date(ph.date), name: ph.name },
    });
  }

  console.log('🔑 オーナーログインを投入...');
  // env 由来の管理者を OWNER として Login に 1 件作成。
  // Login は管理画面ログイン専用テーブル（Staff とは完全独立）。
  const adminUsername = process.env.ADMIN_USER ?? 'admin';
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH ?? bcrypt.hashSync('admin123', 10);
  const firstStore = await prisma.store.findFirst({ orderBy: { id: 'asc' } });
  if (firstStore) {
    await prisma.login.create({
      data: {
        storeId: firstStore.id,
        displayName: 'オーナー',
        username: adminUsername,
        passwordHash: adminPasswordHash,
        role: 'OWNER',
        permissions: [],
        isActive: true,
      },
    });
  }

  const counts = {
    Store: await prisma.store.count(),
    Bed: await prisma.bed.count(),
    Staff: await prisma.staff.count(),
    Login: await prisma.login.count(),
    Menu: await prisma.menu.count(),
    BusinessHour: await prisma.businessHour.count(),
    Holiday: await prisma.holiday.count(),
    PublicHoliday: await prisma.publicHoliday.count(),
  };
  console.log('✅ 投入完了:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
