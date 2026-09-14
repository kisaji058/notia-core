const express =
  require("express");

const router =
  express.Router();

const {
  getUserCategories,
  createUserCategory,
  updateUserCategory,
  deleteUserCategory,
} = require(
  "../../database"
);

function normalizeLabel(
  value
) {
  return String(
    value || ""
  ).trim();
}

router.get(
  "/categories",
  (req, res) => {
    try {
      const categories =
        getUserCategories(
          req.userId
        );

      return res.json(
        categories
      );
    } catch (error) {
      console.error(
        "分類一覧取得エラー:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "分類一覧の取得に失敗しました。",
        });
    }
  }
);

router.post(
  "/categories",
  (req, res) => {
    try {
      const label =
        normalizeLabel(
          req.body?.label
        );

      if (!label) {
        return res
          .status(400)
          .json({
            error:
              "分類名を入力してください。",
          });
      }

      if (
        label.length > 30
      ) {
        return res
          .status(400)
          .json({
            error:
              "分類名は30文字以内にしてください。",
          });
      }

      const category =
        createUserCategory(
          req.userId,
          label
        );

      return res
        .status(201)
        .json({
          success: true,
          category,
        });
    } catch (error) {
      if (
        error.message ===
        "Category label already exists"
      ) {
        return res
          .status(409)
          .json({
            error:
              "同じ名前の分類がすでにあります。",
          });
      }

      console.error(
        "分類追加エラー:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "分類の追加に失敗しました。",
        });
    }
  }
);

router.put(
  "/categories/:id",
  (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "分類IDが正しくありません。",
          });
      }

      const label =
        normalizeLabel(
          req.body?.label
        );

      if (!label) {
        return res
          .status(400)
          .json({
            error:
              "分類名を入力してください。",
          });
      }

      if (
        label.length > 30
      ) {
        return res
          .status(400)
          .json({
            error:
              "分類名は30文字以内にしてください。",
          });
      }

      const category =
        updateUserCategory(
          req.userId,
          id,
          label
        );

      if (!category) {
        return res
          .status(404)
          .json({
            error:
              "分類が見つかりません。",
          });
      }

      return res.json({
        success: true,
        category,
      });
    } catch (error) {
      if (
        error.message ===
        "Category label already exists"
      ) {
        return res
          .status(409)
          .json({
            error:
              "同じ名前の分類がすでにあります。",
          });
      }

      console.error(
        "分類更新エラー:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "分類の更新に失敗しました。",
        });
    }
  }
);

router.delete(
  "/categories/:id",
  (req, res) => {
    try {
      const id =
        Number(
          req.params.id
        );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "分類IDが正しくありません。",
          });
      }

      const result =
        deleteUserCategory(
          req.userId,
          id
        );

      if (
        result.reason ===
        "not_found"
      ) {
        return res
          .status(404)
          .json({
            error:
              "分類が見つかりません。",
          });
      }

      if (
        result.reason ===
        "default_category"
      ) {
        return res
          .status(400)
          .json({
            error:
              "標準分類は削除できません。",
          });
      }

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "分類削除エラー:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "分類の削除に失敗しました。",
        });
    }
  }
);

module.exports =
  router;
