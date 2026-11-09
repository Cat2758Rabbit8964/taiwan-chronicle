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

## 存檔(遊戲 ID)用的資料表與函式
資料表不開放任何直接存取,只能透過下面的函式,憑「完整的 8 碼編號」讀寫那一筆,無法列出別人的編號。在 SQL Editor 執行:

```sql
create table public.saves (
  id text primary key check (id ~ '^[A-HJ-NP-Z2-9]{8}$'),
  nick text not null check (char_length(nick) between 1 and 12),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) < 30000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;   -- 不建立任何政策:匿名金鑰無法直接讀寫

create function public.save_create(p_id text, p_nick text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into saves(id, nick) values (p_id, p_nick);
  return true;
exception when unique_violation then return false;
end $$;

create function public.save_get(p_id text) returns table(nick text, data jsonb)
language sql security definer set search_path = public as $$
  select s.nick, s.data from saves s where s.id = p_id;
$$;

create function public.save_put(p_id text, p_nick text, p_data jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update saves set nick = p_nick, data = p_data, updated_at = now() where id = p_id;
  return found;
end $$;

create function public.save_del(p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from saves where id = p_id;
  return found;
end $$;

revoke all on function public.save_create, public.save_get, public.save_put, public.save_del from public;
grant execute on function public.save_create, public.save_get, public.save_put, public.save_del to anon;
```

注意:編號等同密碼,知道編號的人就能讀寫、刪除那份進度。編號有 32^8 約 1 兆種組合,不易猜到,但不要公開張貼。

## 遊戲 ID 改為自訂(2026-11)
玩家現在自己輸入想用的 ID(6 到 16 個英文字母或數字),已建立的 8 碼 ID 仍然有效。在 SQL Editor 執行:

```sql
alter table public.saves drop constraint saves_id_check;
alter table public.saves add constraint saves_id_check check (id ~ '^[A-Z0-9]{6,16}$');
```

注意:自訂的 ID 比系統亂數產生的更容易被猜到(例如常見單字),而 ID 等同密碼,知道的人就能讀寫、刪除那份存檔。登入頁有「幫我想一組」按鈕可以產生亂數 ID。
