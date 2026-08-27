import UIKit
import Capacitor
import UserNotifications

class NotiaBridgeViewController:
    CAPBridgeViewController
{
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(
            NotiaAppleAuthPlugin()
        )

        bridge?.registerPluginInstance(
            NotiaPushPlugin()
        )

        bridge?.registerPluginInstance(
            NotiaStoreKitPlugin()
        )

#if DEBUG
        if #available(iOS 16.4, *) {
            if let webView = bridge?.webView {
                webView.isInspectable = true
                print(
                    "NOTIA_WEBVIEW_INSPECTABLE:",
                    webView.isInspectable
                )
            } else {
                print(
                    "NOTIA_WEBVIEW_INSPECTABLE: webView nil"
                )
            }
        }
#endif
    }
}

class SceneDelegate:
    UIResponder,
    UIWindowSceneDelegate,
    UNUserNotificationCenterDelegate
{

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        if
            let response =
                connectionOptions
                    .notificationResponse
        {
            let userInfo =
                response.notification
                    .request
                    .content
                    .userInfo

            let route =
                "/today"

            UserDefaults.standard.set(
                route,
                forKey:
                    "notia_pending_push_route"
            )
        }

        guard
            let windowScene =
                scene as? UIWindowScene
        else {
            return
        }

        let bridgeViewController =
            NotiaBridgeViewController()

        bridgeViewController
            .view
            .backgroundColor = .white

        let window =
            UIWindow(
                windowScene: windowScene
            )

        window.backgroundColor = .white
        window.rootViewController =
            bridgeViewController

        self.window = window

        window.makeKeyAndVisible()

        showNotiaSplash(
            on: bridgeViewController.view
        )

        SceneDelegateProxy.shared.scene(
            scene,
            willConnectTo: session,
            options: connectionOptions
        )

        UNUserNotificationCenter
            .current()
            .delegate = self
    }

    private func showNotiaSplash(
        on containerView: UIView
    ) {
        guard
            let image =
                UIImage(
                    named: "Splash"
                )
        else {
            return
        }

        let splashView =
            UIImageView(
                image: image
            )

        splashView.translatesAutoresizingMaskIntoConstraints =
            false

        splashView.contentMode =
            .scaleAspectFill
        splashView.clipsToBounds =
            true

        splashView.backgroundColor =
            .white

        containerView.addSubview(
            splashView
        )

        NSLayoutConstraint.activate([
            splashView.leadingAnchor.constraint(
                equalTo:
                    containerView.leadingAnchor
            ),
            splashView.trailingAnchor.constraint(
                equalTo:
                    containerView.trailingAnchor
            ),
            splashView.topAnchor.constraint(
                equalTo:
                    containerView.topAnchor
            ),
            splashView.bottomAnchor.constraint(
                equalTo:
                    containerView.bottomAnchor
            ),
        ])

        containerView.layoutIfNeeded()

        DispatchQueue.main.asyncAfter(
            deadline:
                .now() + 0.8
        ) {
            UIView.animate(
                withDuration: 0.25,
                animations: {
                    splashView.alpha = 0
                },
                completion: { _ in
                    splashView.removeFromSuperview()
                }
            )
        }
    }

    func scene(
        _ scene: UIScene,
        openURLContexts URLContexts:
            Set<UIOpenURLContext>
    ) {
        SceneDelegateProxy.shared.scene(
            scene,
            openURLContexts:
                URLContexts
        )
    }

    func scene(
        _ scene: UIScene,
        continue userActivity:
            NSUserActivity
    ) {
        SceneDelegateProxy.shared.scene(
            scene,
            continue:
                userActivity
        )
    }
    func userNotificationCenter(
        _ center:
            UNUserNotificationCenter,
        didReceive response:
            UNNotificationResponse,
        withCompletionHandler
            completionHandler:
                @escaping () -> Void
    ) {
        let route =
            "/today"

        UserDefaults.standard.set(
            route,
            forKey:
                "notia_pending_push_route"
        )

        DispatchQueue.main.asyncAfter(
            deadline:
                .now() + 0.5
        ) {
            NotificationCenter.default.post(
                name:
                    Notification.Name(
                        "NotiaPushRouteReceived"
                    ),
                object:
                    route
            )
        }

        completionHandler()
    }

}
