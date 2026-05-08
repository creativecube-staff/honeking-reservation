import { PrismaClient } from '@prisma/client';

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
    practitioners: ['田中 健太', '佐藤 美咲'],
  },
  {
    slug: 'matsudo-higashi',
    prefecture: '千葉県',
    city: '松戸市',
    name: '松戸駅東口整骨院',
    address: '千葉県松戸市松戸 1234-5',
    phone: '047-369-0000',
    displayOrder: 2,
    beds: 6,
    practitioners: ['鈴木 太郎', '山田 由美'],
  },
];

// 共通メニュー（storeId IS NULL で投入。全店舗で自動利用可能）
// 店舗特別メニューは管理画面から店舗ごとに追加する。初期は空。
const COMMON_MENUS = [
  { name: '全身整体 30 分', durationMinutes: 30, priceJpy: 4000, displayOrder: 1 },
  { name: '全身整体 60 分', durationMinutes: 60, priceJpy: 7000, displayOrder: 2 },
  { name: '部分整体（肩・腰） 30 分', durationMinutes: 30, priceJpy: 3500, displayOrder: 3 },
  { name: '骨盤矯正 60 分', durationMinutes: 60, priceJpy: 8000, displayOrder: 4 },
  { name: 'マッサージ 60 分', durationMinutes: 60, priceJpy: 6000, displayOrder: 5 },
];

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
  // 削除順序は依存関係の逆
  await prisma.reservation.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.publicHoliday.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.businessHour.deleteMany();
  await prisma.menu.deleteMany();
  await prisma.practitioner.deleteMany();
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
      await prisma.practitioner.create({
        data: { storeId: store.id, name: s.practitioners[i], displayOrder: i + 1 },
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

  console.log('🎌 国民の祝日(2026-2027)を投入...');
  for (const ph of PUBLIC_HOLIDAYS) {
    await prisma.publicHoliday.create({
      data: { date: new Date(ph.date), name: ph.name },
    });
  }

  const counts = {
    Store: await prisma.store.count(),
    Bed: await prisma.bed.count(),
    Practitioner: await prisma.practitioner.count(),
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
