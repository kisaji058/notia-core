import Foundation
import Capacitor
import StoreKit

@objc(NotiaStoreKitPlugin)
public class NotiaStoreKitPlugin:
    CAPPlugin,
    CAPBridgedPlugin
{
    public let identifier =
        "NotiaStoreKitPlugin"

    public let jsName =
        "NotiaStoreKit"

    public let pluginMethods:
        [CAPPluginMethod] = [
            CAPPluginMethod(
                name: "getProducts",
                returnType:
                    CAPPluginReturnPromise
            ),
            CAPPluginMethod(
                name: "getSubscriptionRenewalInfo",
                returnType:
                    CAPPluginReturnPromise
            ),
            CAPPluginMethod(
                name: "purchase",
                returnType:
                    CAPPluginReturnPromise
            ),
            CAPPluginMethod(
                name: "getCurrentEntitlements",
                returnType:
                    CAPPluginReturnPromise
            ),
            CAPPluginMethod(
                name: "restorePurchases",
                returnType:
                    CAPPluginReturnPromise
            )
        ]

    private let productIds = [
        "com.kisajistudio.notia.standard.monthly",
        "com.kisajistudio.notia.unlimited.monthly"
    ]

    private var transactionUpdatesTask:
        Task<Void, Never>?

    public override func load() {
        let allowedProductIds =
            Set(productIds)

        transactionUpdatesTask =
            Task {
                for await result
                    in Transaction.updates
                {
                    guard
                        case .verified(
                            let transaction
                        ) = result
                    else {
                        continue
                    }

                    guard
                        allowedProductIds.contains(
                            transaction.productID
                        )
                    else {
                        continue
                    }

                    await transaction.finish()
                }
            }
    }

    @objc func getProducts(
        _ call: CAPPluginCall
    ) {
        Task {
            do {
                let products =
                    try await Product.products(
                        for: productIds
                    )

                let sortedProducts =
                    products.sorted {
                        $0.id < $1.id
                    }

                let result =
                    sortedProducts.map {
                        product
                            -> [String: Any]
                        in

                        return [
                            "id":
                                product.id,
                            "displayName":
                                product.displayName,
                            "description":
                                product.description,
                            "displayPrice":
                                product.displayPrice
                        ]
                    }

                await MainActor.run {
                    call.resolve([
                        "products": result
                    ])
                }

            } catch {
                await MainActor.run {
                    call.reject(
                        "StoreKitの商品取得に失敗しました。"
                    )
                }
            }
        }
    }

    @objc func purchase(
        _ call: CAPPluginCall
    ) {
        guard
            let productId =
                call.getString("productId"),
            productIds.contains(productId)
        else {
            call.reject(
                "INVALID_PRODUCT_ID"
            )
            return
        }

        Task {
            do {
                let products =
                    try await Product.products(
                        for: [productId]
                    )

                guard
                    let product =
                        products.first
                else {
                    await MainActor.run {
                        call.reject(
                            "PRODUCT_NOT_FOUND"
                        )
                    }
                    return
                }

                let result =
                    try await product.purchase()

                switch result {

                case .success(
                    let verification
                ):

                    switch verification {

                    case .verified(
                        let transaction
                    ):

                        await transaction.finish()

                        await MainActor.run {
                            call.resolve([
                                "success": true,
                                "productId":
                                    transaction.productID,
                                "transactionId":
                                    String(
                                        transaction.id
                                    ),
                                "originalTransactionId":
                                    String(
                                        transaction
                                            .originalID
                                    ),
                                "purchaseDate":
                                    transaction
                                        .purchaseDate
                                        .ISO8601Format(),
                                "expirationDate":
                                    transaction
                                        .expirationDate?
                                        .ISO8601Format()
                                        as Any,
                                "signedTransaction":
                                    verification
                                        .jwsRepresentation
                            ])
                        }

                    case .unverified(
                        _,
                        let error
                    ):
                        await MainActor.run {
                            call.reject(
                                "UNVERIFIED_TRANSACTION: \(error.localizedDescription)"
                            )
                        }
                    }

                case .pending:
                    await MainActor.run {
                        call.resolve([
                            "success": false,
                            "pending": true
                        ])
                    }

                case .userCancelled:
                    await MainActor.run {
                        call.resolve([
                            "success": false,
                            "cancelled": true
                        ])
                    }

                @unknown default:
                    await MainActor.run {
                        call.reject(
                            "UNKNOWN_PURCHASE_RESULT"
                        )
                    }
                }

            } catch {
                await MainActor.run {
                    call.reject(
                        "PURCHASE_FAILED: \(error.localizedDescription)"
                    )
                }
            }
        }
    }


    @objc func getCurrentEntitlements(
        _ call: CAPPluginCall
    ) {
        Task {
            var entitlements:
                [[String: Any]] = []

            for await result
                in Transaction.currentEntitlements
            {
                switch result {

                case .verified(
                    let transaction
                ):

                    guard
                        productIds.contains(
                            transaction.productID
                        )
                    else {
                        continue
                    }

                    entitlements.append([
                        "productId":
                            transaction.productID,
                        "transactionId":
                            String(
                                transaction.id
                            ),
                        "originalTransactionId":
                            String(
                                transaction.originalID
                            ),
                        "purchaseDate":
                            transaction
                                .purchaseDate
                                .ISO8601Format(),
                        "expirationDate":
                            transaction
                                .expirationDate?
                                .ISO8601Format()
                                as Any,
                        "revocationDate":
                            transaction
                                .revocationDate?
                                .ISO8601Format()
                                as Any,
                        "signedTransaction":
                            result
                                .jwsRepresentation
                    ])

                case .unverified:
                    continue
                }
            }

            let activeProductId:
                String?

            if entitlements.contains(
                where: {
                    $0["productId"]
                        as? String ==
                    "com.kisajistudio.notia.unlimited.monthly"
                }
            ) {
                activeProductId =
                    "com.kisajistudio.notia.unlimited.monthly"
            } else if entitlements.contains(
                where: {
                    $0["productId"]
                        as? String ==
                    "com.kisajistudio.notia.standard.monthly"
                }
            ) {
                activeProductId =
                    "com.kisajistudio.notia.standard.monthly"
            } else {
                activeProductId = nil
            }

            let response:
                [String: Any] = [
                    "activeProductId":
                        activeProductId
                        as Any,
                    "entitlements":
                        entitlements
                ]

            await MainActor.run {
                call.resolve(
                    response
                )
            }
        }
    }


    @objc func getSubscriptionRenewalInfo(
        _ call: CAPPluginCall
    ) {
        Task {
            do {
                var activeTransaction:
                    Transaction?

                for await result
                    in Transaction.currentEntitlements
                {
                    guard
                        case .verified(
                            let transaction
                        ) = result,
                        productIds.contains(
                            transaction.productID
                        )
                    else {
                        continue
                    }

                    if (
                        activeTransaction == nil ||
                        transaction.productID ==
                            "com.kisajistudio.notia.unlimited.monthly"
                    ) {
                        activeTransaction =
                            transaction
                    }
                }

                guard
                    let transaction =
                        activeTransaction
                else {
                    await MainActor.run {
                        call.resolve([
                            "activeProductId":
                                NSNull(),
                            "willAutoRenew":
                                false,
                            "autoRenewPreference":
                                NSNull(),
                            "expirationDate":
                                NSNull()
                        ])
                    }

                    return
                }

                let products =
                    try await Product.products(
                        for: [
                            transaction.productID
                        ]
                    )

                guard
                    let product =
                        products.first,
                    let subscription =
                        product.subscription
                else {
                    throw NSError(
                        domain:
                            "NotiaStoreKit",
                        code: 1,
                        userInfo: [
                            NSLocalizedDescriptionKey:
                                "Subscription information is unavailable."
                        ]
                    )
                }

                let statuses =
                    try await subscription.status

                let matchingStatus =
                    statuses.first {
                        status in

                        guard
                            case .verified(
                                let statusTransaction
                            ) = status.transaction
                        else {
                            return false
                        }

                        return (
                            statusTransaction.productID ==
                            transaction.productID
                        )
                    }

                var willAutoRenew =
                    false

                var autoRenewPreference:
                    String? = nil

                if let status =
                    matchingStatus
                {
                    if case .verified(
                        let renewalInfo
                    ) = status.renewalInfo
                    {
                        willAutoRenew =
                            renewalInfo
                                .willAutoRenew

                        autoRenewPreference =
                            renewalInfo
                                .autoRenewPreference
                    }
                }

                let response:
                    [String: Any] = [
                        "activeProductId":
                            transaction
                                .productID,
                        "willAutoRenew":
                            willAutoRenew,
                        "autoRenewPreference":
                            autoRenewPreference
                            as Any,
                        "expirationDate":
                            transaction
                                .expirationDate?
                                .ISO8601Format()
                            as Any
                    ]

                await MainActor.run {
                    call.resolve(
                        response
                    )
                }
            } catch {
                await MainActor.run {
                    call.reject(
                        "RENEWAL_INFO_FAILED: \(error.localizedDescription)"
                    )
                }
            }
        }
    }


    @objc func restorePurchases(
        _ call: CAPPluginCall
    ) {
        Task {
            do {
                try await AppStore.sync()

                var entitlements:
                    [[String: Any]] = []

                for await result
                    in Transaction.currentEntitlements
                {
                    guard
                        case .verified(
                            let transaction
                        ) = result
                    else {
                        continue
                    }

                    guard
                        productIds.contains(
                            transaction.productID
                        )
                    else {
                        continue
                    }

                    entitlements.append([
                        "productId":
                            transaction.productID,
                        "transactionId":
                            String(
                                transaction.id
                            ),
                        "originalTransactionId":
                            String(
                                transaction.originalID
                            ),
                        "purchaseDate":
                            transaction
                                .purchaseDate
                                .ISO8601Format(),
                        "expirationDate":
                            transaction
                                .expirationDate?
                                .ISO8601Format()
                                as Any,
                        "signedTransaction":
                            result
                                .jwsRepresentation
                    ])
                }

                let activeProductId:
                    String?

                if entitlements.contains(
                    where: {
                        $0["productId"]
                            as? String ==
                        "com.kisajistudio.notia.unlimited.monthly"
                    }
                ) {
                    activeProductId =
                        "com.kisajistudio.notia.unlimited.monthly"
                } else if entitlements.contains(
                    where: {
                        $0["productId"]
                            as? String ==
                        "com.kisajistudio.notia.standard.monthly"
                    }
                ) {
                    activeProductId =
                        "com.kisajistudio.notia.standard.monthly"
                } else {
                    activeProductId = nil
                }

                let response:
                    [String: Any] = [
                        "success": true,
                        "activeProductId":
                            activeProductId
                            as Any,
                        "entitlements":
                            entitlements
                    ]

                await MainActor.run {
                    call.resolve(
                        response
                    )
                }

            } catch {
                await MainActor.run {
                    call.reject(
                        "RESTORE_FAILED: \(error.localizedDescription)"
                    )
                }
            }
        }
    }

}
