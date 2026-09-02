package com.kisajistudio.notia;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@CapacitorPlugin(name = "NotiaPlayBilling")
public class NotiaPlayBillingPlugin extends Plugin
    implements PurchasesUpdatedListener {

    private static final String STANDARD_PRODUCT_ID =
        "com.kisajistudio.notia.standard.monthly";

    private static final String UNLIMITED_PRODUCT_ID =
        "com.kisajistudio.notia.unlimited.monthly";

    private BillingClient billingClient;
    private PluginCall pendingPurchaseCall;

    @Override
    public void load() {
        billingClient =
            BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(
                    PendingPurchasesParams
                        .newBuilder()
                        .enableOneTimeProducts()
                        .build()
                )
                .build();
    }

    private void ensureConnected(
        Runnable onReady,
        PluginCall call
    ) {
        if (
            billingClient != null &&
            billingClient.isReady()
        ) {
            onReady.run();
            return;
        }

        billingClient.startConnection(
            new BillingClientStateListener() {
                @Override
                public void onBillingSetupFinished(
                    BillingResult billingResult
                ) {
                    if (
                        billingResult.getResponseCode() ==
                        BillingClient.BillingResponseCode.OK
                    ) {
                        onReady.run();
                    } else {
                        call.reject(
                            "Google Play Billing connection failed: " +
                            billingResult.getDebugMessage()
                        );
                    }
                }

                @Override
                public void onBillingServiceDisconnected() {
                }
            }
        );
    }

    @com.getcapacitor.PluginMethod
    public void getProducts(PluginCall call) {
        ensureConnected(
            () -> queryProducts(call),
            call
        );
    }

    private void queryProducts(PluginCall call) {
        List<QueryProductDetailsParams.Product> productList =
            Arrays.asList(
                QueryProductDetailsParams.Product
                    .newBuilder()
                    .setProductId(STANDARD_PRODUCT_ID)
                    .setProductType(
                        BillingClient.ProductType.SUBS
                    )
                    .build(),
                QueryProductDetailsParams.Product
                    .newBuilder()
                    .setProductId(UNLIMITED_PRODUCT_ID)
                    .setProductType(
                        BillingClient.ProductType.SUBS
                    )
                    .build()
            );

        QueryProductDetailsParams params =
            QueryProductDetailsParams
                .newBuilder()
                .setProductList(productList)
                .build();

        billingClient.queryProductDetailsAsync(
            params,
            (billingResult, productDetailsResult) -> {
                if (
                    billingResult.getResponseCode() !=
                    BillingClient.BillingResponseCode.OK
                ) {
                    call.reject(
                        "Product query failed: " +
                        billingResult.getDebugMessage()
                    );
                    return;
                }

                JSArray products =
                    new JSArray();

                for (
                    ProductDetails product :
                    productDetailsResult
                        .getProductDetailsList()
                ) {
                    JSObject item =
                        productToJs(product);

                    products.put(item);
                }

                JSObject result =
                    new JSObject();

                result.put(
                    "products",
                    products
                );

                call.resolve(result);
            }
        );
    }

    private JSObject productToJs(
        ProductDetails product
    ) {
        JSObject item =
            new JSObject();

        item.put(
            "id",
            product.getProductId()
        );

        item.put(
            "title",
            product.getTitle()
        );

        item.put(
            "description",
            product.getDescription()
        );

        List<ProductDetails.SubscriptionOfferDetails> offers =
            product.getSubscriptionOfferDetails();

        if (
            offers != null &&
            !offers.isEmpty()
        ) {
            ProductDetails.SubscriptionOfferDetails offer =
                offers.get(0);

            List<ProductDetails.PricingPhase> phases =
                offer
                    .getPricingPhases()
                    .getPricingPhaseList();

            if (!phases.isEmpty()) {
                ProductDetails.PricingPhase phase =
                    phases.get(
                        phases.size() - 1
                    );

                item.put(
                    "price",
                    phase.getFormattedPrice()
                );

                item.put(
                    "priceAmountMicros",
                    phase.getPriceAmountMicros()
                );

                item.put(
                    "currencyCode",
                    phase.getPriceCurrencyCode()
                );
            }
        }

        return item;
    }

    @com.getcapacitor.PluginMethod
    public void purchase(PluginCall call) {
        String productId =
            call.getString("productId");

        if (
            productId == null ||
            productId.isEmpty()
        ) {
            call.reject(
                "productId is required"
            );
            return;
        }

        ensureConnected(
            () -> queryProductForPurchase(
                productId,
                call
            ),
            call
        );
    }

    private void queryProductForPurchase(
        String productId,
        PluginCall call
    ) {
        QueryProductDetailsParams.Product product =
            QueryProductDetailsParams.Product
                .newBuilder()
                .setProductId(productId)
                .setProductType(
                    BillingClient.ProductType.SUBS
                )
                .build();

        QueryProductDetailsParams params =
            QueryProductDetailsParams
                .newBuilder()
                .setProductList(
                    Arrays.asList(product)
                )
                .build();

        billingClient.queryProductDetailsAsync(
            params,
            (billingResult, productDetailsResult) -> {
                if (
                    billingResult.getResponseCode() !=
                    BillingClient.BillingResponseCode.OK
                ) {
                    call.reject(
                        "Product query failed: " +
                        billingResult.getDebugMessage()
                    );
                    return;
                }

                List<ProductDetails> products =
                    productDetailsResult
                        .getProductDetailsList();

                if (products.isEmpty()) {
                    call.reject(
                        "Product not found"
                    );
                    return;
                }

                ProductDetails details =
                    products.get(0);

                List<ProductDetails.SubscriptionOfferDetails> offers =
                    details.getSubscriptionOfferDetails();

                if (
                    offers == null ||
                    offers.isEmpty()
                ) {
                    call.reject(
                        "No subscription offer available"
                    );
                    return;
                }

                String offerToken =
                    offers.get(0)
                        .getOfferToken();

                BillingFlowParams.ProductDetailsParams pdp =
                    BillingFlowParams.ProductDetailsParams
                        .newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(offerToken)
                        .build();

                BillingFlowParams flowParams =
                    BillingFlowParams
                        .newBuilder()
                        .setProductDetailsParamsList(
                            Arrays.asList(pdp)
                        )
                        .build();

                pendingPurchaseCall =
                    call;

                BillingResult launchResult =
                    billingClient.launchBillingFlow(
                        getActivity(),
                        flowParams
                    );

                if (
                    launchResult.getResponseCode() !=
                    BillingClient.BillingResponseCode.OK
                ) {
                    pendingPurchaseCall =
                        null;

                    call.reject(
                        "Billing flow failed: " +
                        launchResult.getDebugMessage()
                    );
                }
            }
        );
    }

    @Override
    public void onPurchasesUpdated(
        BillingResult billingResult,
        List<Purchase> purchases
    ) {
        if (pendingPurchaseCall == null) {
            return;
        }

        if (
            billingResult.getResponseCode() ==
            BillingClient.BillingResponseCode.USER_CANCELED
        ) {
            JSObject result =
                new JSObject();

            result.put(
                "cancelled",
                true
            );

            pendingPurchaseCall
                .resolve(result);

            pendingPurchaseCall =
                null;

            return;
        }

        if (
            billingResult.getResponseCode() !=
            BillingClient.BillingResponseCode.OK ||
            purchases == null ||
            purchases.isEmpty()
        ) {
            pendingPurchaseCall.reject(
                "Purchase failed: " +
                billingResult.getDebugMessage()
            );

            pendingPurchaseCall =
                null;

            return;
        }

        Purchase purchase =
            purchases.get(0);

        JSObject result =
            purchaseToJs(purchase);

        pendingPurchaseCall
            .resolve(result);

        pendingPurchaseCall =
            null;
    }

    private JSObject purchaseToJs(
        Purchase purchase
    ) {
        JSObject result =
            new JSObject();

        boolean pending =
            purchase.getPurchaseState() ==
            Purchase.PurchaseState.PENDING;

        boolean purchased =
            purchase.getPurchaseState() ==
            Purchase.PurchaseState.PURCHASED;

        result.put(
            "success",
            purchased
        );

        result.put(
            "pending",
            pending
        );

        result.put(
            "cancelled",
            false
        );

        result.put(
            "purchaseToken",
            purchase.getPurchaseToken()
        );

        JSArray productIds =
            new JSArray();

        for (
            String id :
            purchase.getProducts()
        ) {
            productIds.put(id);
        }

        result.put(
            "productIds",
            productIds
        );

        result.put(
            "acknowledged",
            purchase.isAcknowledged()
        );

        return result;
    }

    @com.getcapacitor.PluginMethod
public void getCurrentEntitlements(
    PluginCall call
) {
    ensureConnected(
        () -> {
            QueryPurchasesParams params =
                QueryPurchasesParams
                    .newBuilder()
                    .setProductType(
                        BillingClient.ProductType.SUBS
                    )
                    .build();

            billingClient.queryPurchasesAsync(
                params,
                (billingResult, purchases) -> {
                    if (
                        billingResult.getResponseCode() !=
                        BillingClient.BillingResponseCode.OK
                    ) {
                        call.reject(
                            "Entitlement query failed: " +
                            billingResult.getDebugMessage()
                        );
                        return;
                    }

                    JSArray entitlements =
                        new JSArray();

                    String activeProductId =
                        null;

                    for (
                        Purchase purchase :
                        purchases
                    ) {
                        if (
                            purchase.getPurchaseState() !=
                            Purchase.PurchaseState.PURCHASED
                        ) {
                            continue;
                        }

                        for (
                            String productId :
                            purchase.getProducts()
                        ) {
                            JSObject entitlement =
                                new JSObject();

                            entitlement.put(
                                "productId",
                                productId
                            );

                            entitlement.put(
                                "active",
                                true
                            );

                            entitlement.put(
                                "purchaseToken",
                                purchase.getPurchaseToken()
                            );

                            entitlements.put(
                                entitlement
                            );

                            if (
    UNLIMITED_PRODUCT_ID.equals(
        productId
    )
) {
    activeProductId =
        UNLIMITED_PRODUCT_ID;
} else if (
    STANDARD_PRODUCT_ID.equals(
        productId
    ) &&
    activeProductId == null
) {
    activeProductId =
        STANDARD_PRODUCT_ID;
}
                        }
                    }

                    JSObject result =
                        new JSObject();

                    result.put(
                        "entitlements",
                        entitlements
                    );

                    result.put(
                        "activeProductId",
                        activeProductId
                    );

                    call.resolve(result);
                }
            );
        },
        call
    );
}

   @com.getcapacitor.PluginMethod
public void restorePurchases(
    PluginCall call
) {
    ensureConnected(
        () -> {
            QueryPurchasesParams params =
                QueryPurchasesParams
                    .newBuilder()
                    .setProductType(
                        BillingClient.ProductType.SUBS
                    )
                    .build();

            billingClient.queryPurchasesAsync(
                params,
                (billingResult, purchases) -> {
                    if (
                        billingResult.getResponseCode() !=
                        BillingClient.BillingResponseCode.OK
                    ) {
                        call.reject(
                            "Restore failed: " +
                            billingResult.getDebugMessage()
                        );
                        return;
                    }

                    JSArray entitlements =
                        new JSArray();

                    String activeProductId =
                        null;

                    for (
                        Purchase purchase :
                        purchases
                    ) {
                        if (
                            purchase.getPurchaseState() !=
                            Purchase.PurchaseState.PURCHASED
                        ) {
                            continue;
                        }

                        for (
                            String productId :
                            purchase.getProducts()
                        ) {
                            JSObject entitlement =
                                new JSObject();

                            entitlement.put(
                                "productId",
                                productId
                            );

                            entitlement.put(
                                "active",
                                true
                            );

                            entitlement.put(
                                "purchaseToken",
                                purchase.getPurchaseToken()
                            );

                            entitlements.put(
                                entitlement
                            );

                            if (
    UNLIMITED_PRODUCT_ID.equals(
        productId
    )
) {
    activeProductId =
        UNLIMITED_PRODUCT_ID;
} else if (
    STANDARD_PRODUCT_ID.equals(
        productId
    ) &&
    activeProductId == null
) {
    activeProductId =
        STANDARD_PRODUCT_ID;
}
                        }
                    }

                    JSObject result =
                        new JSObject();

                    result.put(
                        "activeProductId",
                        activeProductId
                    );

                    result.put(
                        "entitlements",
                        entitlements
                    );

                    call.resolve(result);
                }
            );
        },
        call
    );
}
}
