<script setup lang="ts">
definePageMeta({ layout: "admin" });

const route = useRoute();
const router = useRouter();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayYm() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

// ── ビュー切替 ──────────────────────────────────────
type View = "month" | "week" | "day" | "person";
const view = computed<View>({
  get() {
    const q = route.query.view;
    if (q === "month") return "month";
    if (q === "week") return "week";
    if (q === "person") return "person";
    return "day";
  },
  set(v) {
    router.replace({ query: { ...route.query, view: v } });
  },
});

// ── 選択中のスタッフ（個人ビュー用）───────────────────
const personStaffId = computed<number | null>({
  get() {
    const q = Number(route.query.staff);
    return Number.isInteger(q) && q > 0 ? q : null;
  },
  set(v) {
    router.replace({
      query: { ...route.query, staff: v == null ? undefined : String(v) },
    });
  },
});

// ── 個人ビューのサブモード（月 / 週）───────────────────
type PersonMode = "month" | "week";
const personMode = computed<PersonMode>({
  get() {
    return route.query.prange === "week" ? "week" : "month";
  },
  set(v) {
    router.replace({ query: { ...route.query, prange: v } });
  },
});

// ── 日付（日ビュー用）─────────────────────────────────
const date = computed<string>({
  get() {
    const q = String(route.query.date ?? "");
    return /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : todayYmd();
  },
  set(v) {
    router.replace({ query: { ...route.query, date: v } });
  },
});

function shiftDate(deltaDays: number) {
  const [y, m, d] = date.value.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + deltaDays);
  date.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const dateLabel = computed(() => {
  const [y, m, d] = date.value.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  const dow = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${y}年${m}月${d}日 (${dow})`;
});

// ── 週（週ビュー用）────────────────────────────────────
// 週は日曜始まり。weekStart は YYYY-MM-DD（日曜日）。
function startOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() - dt.getDay()); // 日曜に巻き戻す
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const week = computed<string>({
  get() {
    const q = String(route.query.week ?? "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return startOfWeek(q);
    // date があれば date から派生
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date ?? ""))) {
      return startOfWeek(String(route.query.date));
    }
    return startOfWeek(todayYmd());
  },
  set(v) {
    router.replace({ query: { ...route.query, week: v } });
  },
});

function shiftWeek(deltaWeeks: number) {
  const [y, m, d] = week.value.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + deltaWeeks * 7);
  week.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const weekLabel = computed(() => {
  const [y, m, d] = week.value.split("-").map(Number);
  const start = new Date(y!, m! - 1, d!);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getDate()}日`;
  }
  return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
});

// ── 月（月ビュー用）────────────────────────────────────
const month = computed<string>({
  get() {
    const q = String(route.query.month ?? "");
    if (/^\d{4}-\d{2}$/.test(q)) return q;
    // date があれば date から派生
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date ?? ""))) {
      return String(route.query.date).slice(0, 7);
    }
    return todayYm();
  },
  set(v) {
    router.replace({ query: { ...route.query, month: v } });
  },
});

function shiftMonth(delta: number) {
  const [y, m] = month.value.split("-").map(Number);
  const dt = new Date(y!, m! - 1 + delta, 1);
  month.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`;
}

const monthLabel = computed(() => {
  const [y, m] = month.value.split("-").map(Number);
  return `${y}年${m}月`;
});

// ── 日ビュー用：その日の各店舗の営業状況 ─────────────
type ScheduleByDate = {
  store: { id: number; name: string; slug: string };
  date: string;
  dayOfWeek: number;
  isHoliday: boolean;
  holidayNote: string | null;
  isPublicHoliday: boolean;
  publicHolidayName: string | null;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  breakStartTime: string | null;
  breakEndTime: string | null;
};

const { data: schedule } = await useFetch<ScheduleByDate[]>(
  "/api/admin/schedule/by-date",
  {
    query: { date },
    watch: [date],
  },
);

const publicHolidayName = computed(() => {
  return (
    (schedule.value ?? []).find((s) => s.isPublicHoliday)?.publicHolidayName ??
    null
  );
});

// ── 全展開／全折りたたみ（全ビュー共通）─────────────────
type StoreLite = { id: number; name: string };
const { data: allStores } = await useFetch<StoreLite[]>("/api/admin/stores", {
  query: { status: "active" },
});
const { collapsed, expandAll, collapseAll } = useShiftStoreCollapse();

const allCollapsed = computed(() => {
  const ids = (allStores.value ?? []).map((s) => s.id);
  if (ids.length === 0) return false;
  return ids.every((id) => collapsed.value.has(id));
});

function onCollapseAll() {
  collapseAll((allStores.value ?? []).map((s) => s.id));
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1 flex-wrap">
      <h1 class="text-2xl font-semibold text-slate-900">シフト管理</h1>
      <!-- 月/週/日ビュー切替 -->
      <div
        class="inline-flex border border-[#8c8f94] rounded-sm overflow-hidden text-sm"
      >
        <button
          type="button"
          class="px-3 py-1"
          :class="
            view === 'month'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'
          "
          @click="view = 'month'"
        >
          月ビュー
        </button>
        <button
          type="button"
          class="px-3 py-1 border-l border-[#8c8f94]"
          :class="
            view === 'week'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'
          "
          @click="view = 'week'"
        >
          週ビュー
        </button>
        <button
          type="button"
          class="px-3 py-1 border-l border-[#8c8f94]"
          :class="
            view === 'day'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'
          "
          @click="view = 'day'"
        >
          日ビュー
        </button>
        <span class="border-l-2 border-[#8c8f94]" />
        <button
          type="button"
          class="px-3 py-1 border-l border-[#8c8f94]"
          :class="
            view === 'person'
              ? 'bg-orange-500 text-white'
              : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'
          "
          @click="view = 'person'"
        >
          個人
        </button>
      </div>

      <!-- 全展開／全折りたたみ（店舗数が 2 以上のときだけ表示）-->
      <button
        v-if="(allStores ?? []).length >= 2"
        type="button"
        class="px-3 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white text-slate-700 hover:bg-[#f6f7f7] inline-flex items-center gap-1"
        :title="allCollapsed ? '全店舗を展開' : '全店舗を折りたたむ'"
        @click="allCollapsed ? expandAll() : onCollapseAll()"
      >
        <UIcon
          :name="
            allCollapsed ? 'i-lucide-chevrons-down' : 'i-lucide-chevrons-up'
          "
          class="size-4"
        />
        {{ allCollapsed ? "全展開" : "全折りたたみ" }}
      </button>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <template v-if="view === 'day'">
        空白部分をドラッグして出勤時間を入力できます。
      </template>
      <template v-else-if="view === 'week'">
        1
        週間の出勤予定を俯瞰します。セルをクリックするとその日の日ビューに切り替わります。
      </template>
      <template v-else-if="view === 'person'">
        スタッフを 1
        人選んで、月単位でシフトを入力します。日付をドラッグすると複数日まとめて登録できます。
      </template>
      <template v-else>
        月単位で出勤状況を俯瞰します。日付をクリックすると日ビューに切り替わります。
      </template>
    </p>

    <!-- 月ビュー -->
    <template v-if="view === 'month'">
      <!-- 月ナビゲーション -->
      <div
        class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap"
      >
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftMonth(-1)"
        >
          ← 前月
        </button>
        <input
          v-model="month"
          type="month"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
        />
        <span class="text-sm font-semibold text-slate-900">{{
          monthLabel
        }}</span>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftMonth(1)"
        >
          翌月 →
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
          @click="month = todayYm()"
        >
          今月
        </button>
      </div>

      <AdminShiftsShiftMonthCalendar :month="month" />
    </template>

    <!-- 週ビュー -->
    <template v-else-if="view === 'week'">
      <!-- 週ナビゲーション -->
      <div
        class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap"
      >
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftWeek(-1)"
        >
          ← 前週
        </button>
        <input
          v-model="week"
          type="date"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
        />
        <span class="text-sm font-semibold text-slate-900">{{
          weekLabel
        }}</span>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftWeek(1)"
        >
          翌週 →
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
          @click="week = startOfWeek(todayYmd())"
        >
          今週
        </button>
      </div>

      <AdminShiftsShiftWeekCalendar :week-start="week" />
    </template>

    <!-- 個人ビュー -->
    <template v-else-if="view === 'person'">
      <!-- 月/週 サブトグル + ナビゲーション -->
      <div
        class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap"
      >
        <div
          class="inline-flex border border-[#8c8f94] rounded-sm overflow-hidden text-sm"
        >
          <button
            type="button"
            class="px-3 py-1"
            :class="
              personMode === 'month'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'
            "
            @click="personMode = 'month'"
          >
            月
          </button>
          <button
            type="button"
            class="px-3 py-1 border-l border-[#8c8f94]"
            :class="
              personMode === 'week'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-slate-700 hover:bg-[#f6f7f7]'
            "
            @click="personMode = 'week'"
          >
            週
          </button>
        </div>

        <!-- 月モード: 月ナビ -->
        <template v-if="personMode === 'month'">
          <button
            type="button"
            class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
            @click="shiftMonth(-1)"
          >
            ← 前月
          </button>
          <input
            v-model="month"
            type="month"
            class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
          />
          <span class="text-sm font-semibold text-slate-900">{{
            monthLabel
          }}</span>
          <button
            type="button"
            class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
            @click="shiftMonth(1)"
          >
            翌月 →
          </button>
          <button
            type="button"
            class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
            @click="month = todayYm()"
          >
            今月
          </button>
        </template>

        <!-- 週モード: 週ナビ -->
        <template v-else>
          <button
            type="button"
            class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
            @click="shiftWeek(-1)"
          >
            ← 前週
          </button>
          <input
            v-model="week"
            type="date"
            class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
          />
          <span class="text-sm font-semibold text-slate-900">{{
            weekLabel
          }}</span>
          <button
            type="button"
            class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
            @click="shiftWeek(1)"
          >
            翌週 →
          </button>
          <button
            type="button"
            class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
            @click="week = startOfWeek(todayYmd())"
          >
            今週
          </button>
        </template>
      </div>

      <AdminShiftsShiftPersonCalendar
        v-if="personMode === 'month'"
        v-model:staff-id="personStaffId"
        :month="month"
      />
      <AdminShiftsShiftPersonWeekCalendar
        v-else
        v-model:staff-id="personStaffId"
        :week-start="week"
      />
    </template>

    <!-- 日ビュー -->
    <template v-else>
      <!-- 日付ナビゲーション -->
      <div
        class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-center gap-3 flex-wrap"
      >
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftDate(-1)"
        >
          ← 前日
        </button>
        <input
          v-model="date"
          type="date"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500"
        />
        <span class="text-sm font-semibold text-slate-900">{{
          dateLabel
        }}</span>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
          @click="shiftDate(1)"
        >
          翌日 →
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm ml-2"
          @click="date = todayYmd()"
        >
          今日
        </button>
      </div>

      <!-- その日の各店舗の営業状況 -->
      <div
        v-if="(schedule ?? []).length > 0"
        class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4"
      >
        <h3
          class="text-xs font-semibold text-slate-900 mb-2 flex items-center gap-2"
        >
          <UIcon name="i-lucide-clock" class="size-4" />
          この日の営業状況
          <span v-if="publicHolidayName" class="text-orange-700">
            祝日: {{ publicHolidayName }}（日曜扱い）
          </span>
        </h3>
        <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div
            v-for="s in schedule"
            :key="s.store.id"
            class="flex items-center gap-2"
          >
            <span class="font-medium text-slate-900">{{ s.store.name }}:</span>
            <span v-if="s.isHoliday" class="text-red-700 font-medium">
              🚫 店休日<span
                v-if="s.holidayNote"
                class="text-xs text-slate-500"
              >
                ({{ s.holidayNote }})</span
              >
            </span>
            <span v-else-if="s.isClosed" class="text-slate-500"> 定休 </span>
            <span v-else-if="s.openTime && s.closeTime" class="text-slate-700">
              {{ s.openTime }}–{{ s.closeTime }}
              <span
                v-if="s.breakStartTime && s.breakEndTime"
                class="text-xs text-slate-500"
              >
                （休憩 {{ s.breakStartTime }}–{{ s.breakEndTime }}）
              </span>
            </span>
            <span v-else class="text-slate-500 text-xs"> 営業時間未設定 </span>
          </div>
        </div>
      </div>

      <AdminShiftsShiftDayCalendar :date="date" />

      <!-- その日の予約一覧 -->
      <div class="mt-6">
        <AdminReservationsDayReservationsList :date="date" />
      </div>
    </template>
  </div>
</template>
