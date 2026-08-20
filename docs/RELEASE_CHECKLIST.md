# Notia Production Release Checklist

## 1. Local pre-release check

- [ ] `git status` が clean
- [ ] 対象変更の動作確認済み
- [ ] `node --check` が対象JavaScriptで成功
- [ ] `git diff --check` が成功
- [ ] 必要なDB変更は migration 化されている
- [ ] migration をローカルで確認済み
- [ ] コミット済み
- [ ] `git push origin main` 済み

## 2. Production pre-deploy backup

VPSで実行:

    cd ~/notia-core
    node scripts/backup-database.js

確認:

- [ ] バックアップ作成成功
- [ ] `backups/` に新しいDBが存在
- [ ] 必要に応じて `PRAGMA integrity_check` が `ok`

## 3. Production deploy

    cd ~/notia-core
    git status --short
    git pull origin main

確認:

- [ ] pull前に意図しない未コミット変更がない
- [ ] 正しいcommitまで更新された

## 4. Database migration

    node scripts-run-migrations.js

確認:

- [ ] migrationが正常終了
- [ ] 想定外のmigrationが実行されていない
- [ ] エラーなし

## 5. Syntax check

    node --check server.js
    node --check database.js

変更したJavaScriptも必要に応じて確認する。

- [ ] SyntaxErrorなし

## 6. Application restart

    pm2 restart notia
    pm2 status notia

確認:

- [ ] `notia` が `online`
- [ ] 異常な再起動ループがない

## 7. Log check

    pm2 logs notia --lines 50 --nostream

必要に応じて:

    ls -lh logs/
    tail -50 logs/error-*.log

確認:

- [ ] 新しい重大エラーなし
- [ ] `uncaughtException` なし
- [ ] `unhandledRejection` なし
- [ ] `express.unhandled` の異常増加なし

## 8. Backup timer check

    systemctl status notia-backup.timer --no-pager
    systemctl list-timers notia-backup.timer --no-pager

確認:

- [ ] timerが `active (waiting)`
- [ ] 次回実行日時が表示される

## 9. Production smoke test

ブラウザから以下を確認する。

- [ ] ログイン
- [ ] Chat送信
- [ ] Today表示
- [ ] Plan / Tasks表示
- [ ] Calendar表示
- [ ] Routine表示
- [ ] タスク作成
- [ ] 予定作成
- [ ] ルーティーン作成
- [ ] Google連携状態表示
- [ ] Google Calendar同期

## 10. Final verification

    cd ~/notia-core
    git status --short
    git log -3 --oneline
    pm2 status notia

確認:

- [ ] Git working tree clean
- [ ] 想定したcommitがHEAD
- [ ] PM2 online
- [ ] ユーザー操作に問題なし

## Rollback guideline

重大な不具合が発生した場合:

1. 新規操作を可能な範囲で止める
2. 現在のDBを追加バックアップする
3. 問題のcommitを特定する
4. コードのみの問題なら直前の安定commitへ戻す
5. DB migrationを伴う場合は安易にDBを戻さず、バックアップとmigration内容を確認する
6. PM2を再起動する
7. smoke testを再実施する

本番DBを復元する場合は、必ず現行DBを別途保存してから行う。
