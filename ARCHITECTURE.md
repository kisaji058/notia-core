# Notia Core Architecture

## Overview

Notia Core は、会話を整理し、行動へ変えるための AI Runtime である。

目的は単なるチャットではなく、会話理解・タスク管理・メモリ管理・スケジュール管理・通知・将来的な外部連携を扱える中核システムを作ること。

---

## Core Flow

```text
User
  ↓
server.js
  ↓
ChatRuntime
  ↓
Builder
  ↓
ConversationAnalyzer
  ↓
Managers
  ↓
PromptBuilder
  ↓
OpenAI
  ↓
Response