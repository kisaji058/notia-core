(() => {
  "use strict";

  const STANDARD_PRODUCT_ID =
    "com.kisajistudio.notia.standard.monthly";

  const UNLIMITED_PRODUCT_ID =
    "com.kisajistudio.notia.unlimited.monthly";

  const REASON_COPY = {
    plan: {
      title: "Notiaのプラン",
      description:
        "あなたに合ったプランを選べます。",
    },

    "document-free-limit": {
      title: "読み取り上限に達しました",
      description:
        "FreeプランではPDF・画像を月3枚まで読み取れます。",
    },

    "document-standard-limit": {
      title: "今月の読み取り上限に達しました",
      description:
        "UnlimitedならPDF・画像を枚数を気にせず読み取れます。",
    },

    "google-sync": {
      title: "Googleカレンダーと同期",
      description:
        "Googleカレンダー同期はStandard以上で利用できます。",
    },
  };

  async function hideAdBanner() {
    try {
      const adMob =
        window.Capacitor
          ?.Plugins
          ?.AdMob;

      if (adMob?.removeBanner) {
        await adMob.removeBanner();
      }
    } catch (error) {
      console.warn(
        "Paywall banner hide error:",
        error
      );
    }

    document.documentElement
      .style
      .setProperty(
        "--ad-banner-height",
        "0px"
      );
  }

  async function restoreAdBanner() {
    try {
      await window.NotiaRuntime
        ?.updateAdBanner?.();
    } catch (error) {
      console.warn(
        "Paywall banner restore error:",
        error
      );
    }
  }

  function close({
    restoreAd = true,
  } = {}) {
    document
      .querySelectorAll(".notia-paywall-sheet")
      .forEach((sheet) => {
        sheet.remove();
      });

    if (restoreAd) {
      restoreAdBanner();
    }
  }

  function getReasonCopy(reason) {
    return (
      REASON_COPY[reason] ||
      REASON_COPY.plan
    );
  }

  async function getProducts() {
    const runtime =
      window.NotiaRuntime;

    const storeKit =
      runtime?.getStoreKit?.();

    if (!storeKit) {
      throw new Error(
        "StoreKit plugin not available"
      );
    }

    const result =
      await storeKit.getProducts();

    return Array.isArray(
      result?.products
    )
      ? result.products
      : [];
  }

  function findProduct(
    products,
    productId
  ) {
    return products.find(
      (product) =>
        product?.id === productId
    );
  }

  async function purchase(
    productId,
    button
  ) {
    const runtime =
      window.NotiaRuntime;

    if (
      !runtime?.purchaseSubscription
    ) {
      throw new Error(
        "Purchase function not available"
      );
    }

    const originalText =
      button.textContent;

    try {
      button.disabled = true;
      button.textContent =
        "購入処理中...";

      const result =
        await runtime
          .purchaseSubscription(
            productId
          );

      if (result?.cancelled) {
        return;
      }

      if (result?.pending) {
        alert(
          "購入は保留中です。承認後に反映されます。"
        );
        return;
      }

      if (result?.success === true) {
        close();

        window.dispatchEvent(
          new CustomEvent(
            "notia:subscription-updated",
            {
              detail: {
                productId,
              },
            }
          )
        );

        alert(
          "プランを更新しました。"
        );
      }
    } catch (error) {
      console.error(
        "Paywall purchase error:",
        error
      );

      alert(
        "購入処理に失敗しました。時間をおいてもう一度お試しください。"
      );
    } finally {
      if (
        document.body.contains(
          button
        )
      ) {
        button.disabled = false;
        button.textContent =
          originalText;
      }
    }
  }

  async function restore(
    button
  ) {
    const runtime =
      window.NotiaRuntime;

    if (
      !runtime?.restoreSubscription
    ) {
      throw new Error(
        "Restore function not available"
      );
    }

    const originalText =
      button.textContent;

    try {
      button.disabled = true;
      button.textContent =
        "復元中...";

      await runtime
        .restoreSubscription();

      close();

      window.dispatchEvent(
        new CustomEvent(
          "notia:subscription-updated"
        )
      );

      alert(
        "購入情報を復元しました。"
      );
    } catch (error) {
      console.error(
        "Paywall restore error:",
        error
      );

      alert(
        "購入情報を復元できませんでした。"
      );
    } finally {
      if (
        document.body.contains(
          button
        )
      ) {
        button.disabled = false;
        button.textContent =
          originalText;
      }
    }
  }

  async function open(options = {}) {
    close({
      restoreAd: false,
    });

    await hideAdBanner();

    const reason =
      options.reason || "plan";

    const copy =
      getReasonCopy(reason);

    const sheet =
      document.createElement("div");

    sheet.className =
      "notia-paywall-sheet";

    sheet.innerHTML = `
      <div class="notia-paywall-card">
        <div class="notia-paywall-header">
          <div>
            <p class="notia-paywall-eyebrow">
              NOTIA PREMIUM
            </p>
            <h2>
              ${copy.title}
            </h2>
            <p class="notia-paywall-description">
              ${copy.description}
            </p>
          </div>

          <button
            class="notia-paywall-close"
            type="button"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div class="notia-paywall-loading">
          プラン情報を読み込んでいます...
        </div>

        <div
          class="notia-paywall-plans"
          hidden
        >
          <section
            class="notia-paywall-plan"
            data-plan="standard"
          >
            <div class="notia-paywall-plan-heading">
              <div>
                <h3>
                  Standard
                </h3>
                <p>
                  毎日の管理をもっと便利に
                </p>
              </div>

              <strong
                class="notia-paywall-price"
                data-price="standard"
              >
                —
              </strong>
            </div>

            <ul>
              <li>
                広告なし
              </li>
              <li>
                Googleカレンダー同期
              </li>
              <li>
                PDF・画像読み取り 月30枚
              </li>
            </ul>

            <button
              class="notia-paywall-purchase"
              type="button"
              data-product-id="${STANDARD_PRODUCT_ID}"
            >
              Standardを選ぶ
            </button>
          </section>

          <section
            class="notia-paywall-plan notia-paywall-plan-featured"
            data-plan="unlimited"
          >
            <div class="notia-paywall-plan-badge">
              UNLIMITED
            </div>

            <div class="notia-paywall-plan-heading">
              <div>
                <h3>
                  Unlimited
                </h3>
                <p>
                  読み取り枚数を気にせず使う
                </p>
              </div>

              <strong
                class="notia-paywall-price"
                data-price="unlimited"
              >
                —
              </strong>
            </div>

            <ul>
              <li>
                Standardのすべての機能
              </li>
              <li>
                PDF・画像読み取り 無制限
              </li>
            </ul>

            <button
              class="notia-paywall-purchase"
              type="button"
              data-product-id="${UNLIMITED_PRODUCT_ID}"
            >
              Unlimitedを選ぶ
            </button>
          </section>
        </div>

        <p
          class="notia-paywall-error"
          hidden
        >
          プラン情報を取得できませんでした。
        </p>

        <button
          class="notia-paywall-restore"
          type="button"
        >
          購入を復元
        </button>

        <div class="notia-paywall-legal">
          <p class="notia-paywall-note">
            各プランは月額の自動更新サブスクリプションです。
            購入確定時にApple Accountへ請求され、
            更新日の24時間前までに解約されない限り
            自動的に更新されます。
          </p>

          <p class="notia-paywall-note">
            サブスクリプションの管理・解約は
            Apple Accountの設定から行えます。
          </p>

          <div class="notia-paywall-legal-links">
            <a href="#" data-legal-url="https://notia.cecily-ai.top/terms">
              利用規約
            </a>

            <span aria-hidden="true">
              ・
            </span>

            <a href="#" data-legal-url="https://notia.cecily-ai.top/privacy">
              プライバシーポリシー
            </a>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(
      sheet
    );

    const closeButton =
      sheet.querySelector(
        ".notia-paywall-close"
      );

    const loading =
      sheet.querySelector(
        ".notia-paywall-loading"
      );

    const plans =
      sheet.querySelector(
        ".notia-paywall-plans"
      );

    const error =
      sheet.querySelector(
        ".notia-paywall-error"
      );

    const restoreButton =
      sheet.querySelector(
        ".notia-paywall-restore"
      );

    const legalLinks =
      sheet.querySelectorAll(
        "[data-legal-url]"
      );


    closeButton.addEventListener(
      "click",
      close
    );

    sheet.addEventListener(
      "click",
      (event) => {
        if (event.target === sheet) {
          close();
        }
      }
    );

    restoreButton.addEventListener(
      "click",
      () => {
        restore(
          restoreButton
        );
      }
    );

    legalLinks.forEach(
      (link) => {
        link.addEventListener(
          "click",
          async (event) => {
            event.preventDefault();
            event.stopPropagation();

            const url =
              link.dataset.legalUrl;

            if (!url) return;

            try {
              const Browser =
                window.Capacitor
                  ?.Plugins
                  ?.Browser;

              if (!Browser?.open) {
                throw new Error(
                  "Browser plugin unavailable"
                );
              }

              await Browser.open({
                url
              });
            } catch (error) {
              console.error(
                "Paywall Browser.open failed:",
                error
              );
            }
          }
        );
      }
    );


    try {
      const products =
        await getProducts();

      const subscription =
        await window.NotiaRuntime
          ?.getCurrentSubscription?.();

      const activeProductId =
        subscription?.activeProductId ||
        null;

      let renewalInfo = null;

      try {
        const storeKit =
          window.NotiaRuntime
            ?.getStoreKit?.();

        if (
          storeKit
            ?.getSubscriptionRenewalInfo
        ) {
          renewalInfo =
            await storeKit
              .getSubscriptionRenewalInfo();
        }
      } catch (error) {
        console.warn(
          "Paywall renewal info error:",
          error
        );
      }

      const standard =
        findProduct(
          products,
          STANDARD_PRODUCT_ID
        );

      const unlimited =
        findProduct(
          products,
          UNLIMITED_PRODUCT_ID
        );

      const standardPrice =
        sheet.querySelector(
          '[data-price="standard"]'
        );

      const unlimitedPrice =
        sheet.querySelector(
          '[data-price="unlimited"]'
        );

      standardPrice.textContent =
        standard?.displayPrice ||
        "—";

      unlimitedPrice.textContent =
        unlimited?.displayPrice ||
        "—";

      const standardButton =
        sheet.querySelector(
          `[data-product-id="${STANDARD_PRODUCT_ID}"]`
        );

      const unlimitedButton =
        sheet.querySelector(
          `[data-product-id="${UNLIMITED_PRODUCT_ID}"]`
        );

      const standardPlan =
        sheet.querySelector(
          '[data-plan="standard"]'
        );

      const unlimitedPlan =
        sheet.querySelector(
          '[data-plan="unlimited"]'
        );

      if (
        activeProductId ===
        STANDARD_PRODUCT_ID
      ) {
        standardButton.disabled = true;
        standardButton.textContent =
          "現在のプラン";

        standardPlan.classList.add(
          "notia-paywall-plan-current"
        );

        unlimitedButton.textContent =
          "Unlimitedにアップグレード";
      } else if (
        activeProductId ===
        UNLIMITED_PRODUCT_ID
      ) {
        unlimitedButton.disabled = true;
        unlimitedButton.textContent =
          "現在のプラン";

        unlimitedPlan.classList.add(
          "notia-paywall-plan-current"
        );

        standardButton.textContent =
          "Standardに変更";

        if (
          renewalInfo
            ?.willAutoRenew === true &&
          renewalInfo
            ?.autoRenewPreference ===
            STANDARD_PRODUCT_ID
        ) {
          const notice =
            document.createElement(
              "p"
            );

          notice.className =
            "notia-paywall-change-notice";

          notice.textContent =
            "次回更新日からStandardに変更予定";

          unlimitedPlan.appendChild(
            notice
          );
        }
      }

      loading.hidden = true;
      plans.hidden = false;

      sheet
        .querySelectorAll(
          ".notia-paywall-purchase"
        )
        .forEach((button) => {
          if (button.disabled) {
            return;
          }

          button.addEventListener(
            "click",
            () => {
              purchase(
                button.dataset.productId,
                button
              );
            }
          );
        });
    } catch (loadError) {
      console.error(
        "Paywall products error:",
        loadError
      );

      loading.hidden = true;
      error.hidden = false;
    }
  }

  window.NotiaPaywall = {
    open,
    close,
  };
})();
