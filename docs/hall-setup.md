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

## 逃脫遊戲榜(新疆 xj、西藏 tb)

穿越地圖的兩款逃脫遊戲各有一張榜。請在 SQL Editor 再執行一次(`hall_subject_check` 要加入兩個新科目):

```sql
alter table public.hall drop constraint hall_subject_check;
alter table public.hall add constraint hall_subject_check check (subject in ('lang','lang_en','lang_jp','math','sci','soc','xj','tb'));
```

## 音樂科榜(music,分數後面標歌名)

節奏遊戲(國旗歌、雨夜花)共用一張「音樂科」榜,分數後面用括號標示是哪一首歌。請在 SQL Editor 再執行一次:

```sql
alter table public.hall add column if not exists note text;
alter table public.hall add constraint hall_note_check check (note is null or char_length(note) <= 8);
alter table public.hall drop constraint hall_subject_check;
alter table public.hall add constraint hall_subject_check check (subject in ('lang','lang_en','lang_jp','math','sci','soc','xj','tb','music'));
```

## 每個帳號每科只留最高分(一人一筆)
芳名錄改成:只有登入遊戲 ID 的玩家能留名(訪客不能),每個帳號在每個科目只保留自己的最高分。舊紀錄全部保留在 `hall` 表,不會被刪;玩家看到的榜單改讀 `hall_board` 檢視表,同一科目、同一個名字只顯示分數最高的一筆。請在 SQL Editor 執行:

```sql
-- 1. 帳號代號:遊戲 ID 加鹽後做 SHA-256,公開表看不出原本的 ID(舊紀錄這欄是空的)
alter table public.hall add column if not exists acct text;
create unique index if not exists hall_one_per_acct on public.hall (subject, acct) where acct is not null;

-- 2. 前台榜單:同一科目、同一名字只取最高分(後台 hall 表仍保有全部紀錄)
create or replace view public.hall_board as
select distinct on (subject, name) subject, name, score, note, created_at
from public.hall
order by subject, name, score desc, created_at asc;

-- 3. 留名函式:確認遊戲 ID 存在,新增或在更高分時更新
create or replace function public.hall_submit(p_id text, p_subject text, p_name text, p_score int, p_note text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare h text; old int;
begin
  if not exists (select 1 from saves where id = p_id) then raise exception 'bad id'; end if;
  h := encode(digest('hall:' || p_id, 'sha256'), 'hex');
  select score into old from hall where subject = p_subject and acct = h;
  if old is null then
    insert into hall(subject, name, score, note, acct) values (p_subject, p_name, p_score, p_note, h);
    return 'saved';
  elsif p_score > old then
    update hall set name = p_name, score = p_score, note = p_note, created_at = now() where subject = p_subject and acct = h;
    return 'saved';
  else
    update hall set name = p_name where subject = p_subject and acct = h;
    return 'kept';
  end if;
end $$;

-- 4. 權限:匿名金鑰不能再直接新增或讀取 hall 表(才看不到 acct),只能讀檢視表和呼叫函式
drop policy if exists "任何人可新增" on public.hall;
revoke insert, update, delete, select on public.hall from anon, authenticated;
revoke all on function public.hall_submit from public;
grant execute on function public.hall_submit to anon;
grant select on public.hall_board to anon;
```

注意:執行第 4 段後,舊版網頁(還在用直接新增的版本)會送不出成績,請在新版網頁上線後再執行,或兩者同時進行。刪除不當名字仍在 Table Editor 的 `hall` 表操作。
