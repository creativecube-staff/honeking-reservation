-- Staff に役職カラム role を追加（表示用ラベル。Login.role と異なり認証・権限とは無関係）。
ALTER TABLE "Staff" ADD COLUMN "role" "Role";
