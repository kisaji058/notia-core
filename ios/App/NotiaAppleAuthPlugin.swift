import Foundation
import Capacitor
import AuthenticationServices
import CryptoKit

@objc(NotiaAppleAuthPlugin)
public class NotiaAppleAuthPlugin:
    CAPPlugin,
    CAPBridgedPlugin,
    ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding
{
    public let identifier =
        "NotiaAppleAuthPlugin"

    public let jsName =
        "NotiaAppleAuth"

    public let pluginMethods:
        [CAPPluginMethod] = [
            CAPPluginMethod(
                name: "isAvailable",
                returnType:
                    CAPPluginReturnPromise
            ),
            CAPPluginMethod(
                name: "signIn",
                returnType:
                    CAPPluginReturnPromise
            )
        ]

    private var signInCall:
        CAPPluginCall?

    private func sha256(
        _ value: String
    ) -> String {
        let data =
            Data(value.utf8)

        let digest =
            SHA256.hash(
                data: data
            )

        return digest
            .map {
                String(
                    format: "%02x",
                    $0
                )
            }
            .joined()
    }

    @objc func isAvailable(
        _ call: CAPPluginCall
    ) {
        call.resolve([
            "available": true
        ])
    }

    @objc func signIn(
        _ call: CAPPluginCall
    ) {
        guard
            let nonce =
                call.getString("nonce"),
            !nonce.isEmpty
        else {
            call.reject(
                "Apple nonce is required"
            )
            return
        }

        signInCall = call

        let provider =
            ASAuthorizationAppleIDProvider()

        let request =
            provider.createRequest()

        request.requestedScopes = [
            .fullName,
            .email
        ]

        request.nonce =
            sha256(nonce)

        let controller =
            ASAuthorizationController(
                authorizationRequests: [
                    request
                ]
            )

        controller.delegate = self
        controller.presentationContextProvider =
            self

        controller.performRequests()
    }

    public func authorizationController(
        controller:
            ASAuthorizationController,
        didCompleteWithAuthorization
            authorization:
                ASAuthorization
    ) {
        guard
            let credential =
                authorization.credential
                as? ASAuthorizationAppleIDCredential
        else {
            signInCall?.reject(
                "Apple認証情報を取得できませんでした。"
            )
            signInCall = nil
            return
        }

        guard
            let identityTokenData =
                credential.identityToken,
            let identityToken =
                String(
                    data:
                        identityTokenData,
                    encoding: .utf8
                )
        else {
            signInCall?.reject(
                "Apple identity tokenを取得できませんでした。"
            )
            signInCall = nil
            return
        }

        var result:
            [String: Any] = [
                "user":
                    credential.user,
                "identityToken":
                    identityToken
            ]

        if
            let authorizationCodeData =
                credential.authorizationCode,
            let authorizationCode =
                String(
                    data:
                        authorizationCodeData,
                    encoding: .utf8
                )
        {
            result["authorizationCode"] =
                authorizationCode
        }

        if let email = credential.email {
            result["email"] = email
        }

        if let fullName = credential.fullName {
            let formatter =
                PersonNameComponentsFormatter()

            let name =
                formatter.string(
                    from: fullName
                )

            if !name.isEmpty {
                result["displayName"] =
                    name
            }
        }

        signInCall?.resolve(result)
        signInCall = nil
    }

    public func authorizationController(
        controller:
            ASAuthorizationController,
        didCompleteWithError
            error: Error
    ) {
        if
            let authError =
                error as?
                    ASAuthorizationError,
            authError.code ==
                .canceled
        {
            signInCall?.reject(
                "APPLE_AUTH_CANCELLED"
            )
        } else {
            signInCall?.reject(
                "Appleログインに失敗しました。"
            )
        }

        signInCall = nil
    }

    public func presentationAnchor(
        for controller:
            ASAuthorizationController
    ) -> ASPresentationAnchor {
        if
            let window =
                bridge?
                    .viewController?
                    .view
                    .window
        {
            return window
        }

        return UIWindow()
    }
}
