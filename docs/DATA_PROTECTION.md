# Notia Beta User Data Protection Policy

## 1. 基本方針

Notiaのβユーザーデータは本番データとして扱う。

開発・検証・修正のために、
既存βユーザーのデータを意図的に変更・削除してはならない。

## 2. ユーザー単位のデータ分離

ユーザーに紐づくデータの取得・更新・削除では、
必ず `user_id` を条件に含める。

例:

    WHERE id = ?
      AND user_id = ?

対象:

- tasks
- events
- routines
- conversations
- integrations
- external_calendar_events
- task_calendar_links
- memories
- notification_settings
- daily_notification_logs
- auth_identities

新しいユーザーデータ用テーブルを追加する場合も、
原則として `user_id` を持たせる。

## 3. APIでのユーザー識別

APIからユーザーデータを操作する場合、
クライアントから送信された userId を信用しない。

原則として、

    req.session.userId

を現在ユーザーの識別子として使用する。

URLパラメータやrequest bodyに含まれるIDは、
データ自体のIDとしてのみ使用し、
所有ユーザー判定には使用しない。

## 4. 本番DB直接編集

本番DBの直接編集は原則禁止する。

やむを得ず直接操作する場合:

1. 事前にDBバックアップを作成する
2. バックアップの存在を確認する
3. 対象user_idを確認する
4. SELECTで対象行を事前確認する
5. UPDATE / DELETEには必ずuser_id条件を付ける
6. 操作後に対象データを再確認する

対象user_idを確認できない状態では、
UPDATE / DELETEを実行しない。

## 5. アカウント削除

本番βユーザーのアカウント削除を
動作テスト目的で実行してはならない。

アカウント削除機能のテストは、
専用のテストユーザーのみで行う。

削除対象は、
現在ログインしているユーザーの
session userIdから決定する。

## 6. テストデータ

開発テストでは、
可能な限り専用テストユーザーを使用する。

他のβユーザーのデータを、
テスト入力・削除・変換・同期確認に使用しない。

テスト用データには、
識別しやすい名前を使用する。

例:

    テスト
    通知テスト
    migration-test

## 7. Google連携データ

Google Calendar連携情報は
必ずuser_id単位で管理する。

以下を別ユーザー間で共有してはならない。

- access token
- refresh token
- Google予定
- task calendar link
- routine Google event ID
- last sync情報

ログにはaccess token、
refresh token、
cookie、
Authorization情報を記録しない。

## 8. Database Migration

本番DBのschema変更は、
原則として正式migrationを使用する。

schemaを本番DBへ直接変更してはならない。

migration実行前には、
必ず本番DBバックアップを作成する。

migration実行後は、

    node scripts-run-migrations.js

の結果を確認する。

## 9. Backup

本番DBは毎日自動バックアップする。

現在の標準設定:

- systemd timer
- 毎日 03:30 JST
- 最大30世代保持

リリース前や本番DBを操作する前にも、
追加の手動バックアップを作成する。

## 10. Restore

本番DBを復元する場合、
現在のDBを上書きする前に必ず退避する。

復元手順:

1. 現行DBを追加バックアップ
2. 復元対象バックアップを特定
3. integrity_checkを実行
4. 復元理由と対象時点を確認
5. サービス停止が必要か判断
6. DB復元
7. migration状態確認
8. PM2再起動
9. smoke test
10. ユーザーデータ確認

安易に古いDBへ巻き戻さない。

## 11. エラー・障害発生時

データ不整合が疑われる場合は、
修正より先に現状DBをバックアップする。

原因が不明なまま、
一括UPDATEや一括DELETEを実行しない。

重大障害の場合は、
RELEASE_CHECKLIST.md の
Rollback guidelineにも従う。

## 12. β期間中の最優先事項

β期間中は以下を最優先する。

1. ユーザー間データ混線を起こさない
2. 既存ユーザーデータを失わない
3. 削除・更新対象を誤らない
4. Google連携情報を混在させない
5. migration前にバックアップする
6. 復元可能な状態を維持する
