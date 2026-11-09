# 芳名錄設定(Supabase 免費方案)

1. 到 https://supabase.com 註冊並建立專案。
2. 左側 SQL Editor 貼上下面整段並執行:

```sql
create table public.hall (
  id bigint generated always as identity primary key,
  subject text not null check (subject in ('lang_en','lang_jp','math','sci','soc')),
  name text not null check (char_length(name) between 1 and 12),
  score int not null check (score between 1 and 100000),
  created_at timestamptz not null default now()
);
alter table public.hall enable row level security;
create policy "任何人可讀" on public.hall for select using (true);
create policy "任何人可新增" on public.hall for insert with check (true);
-- 沒有 update / delete 政策:玩家無法修改或刪除,站長在 Table Editor 手動刪除不當名字。
```

3. Project Settings → API:複製 Project URL 與 anon public key,填入 `hall-config.js`。
4. 推上 GitHub 即生效。

注意:成績是玩家的瀏覽器送出的,沒有伺服器端驗證,有心人可以偽造(欄位檢查只擋掉明顯離譜的值)。這是娛樂用榜單,不要拿來當獎勵依據。

## 已經建過表的話(2026-11 改成英日分榜、分數無上限)
在 SQL Editor 執行:

```sql
alter table public.hall drop constraint hall_subject_check;
alter table public.hall add constraint hall_subject_check check (subject in ('lang_en','lang_jp','math','sci','soc'));
alter table public.hall drop constraint hall_score_check;
alter table public.hall add constraint hall_score_check check (score between 1 and 100000);
```
