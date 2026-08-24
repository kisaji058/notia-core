import UIKit
import Capacitor
import UserNotifications

@UIApplicationMain
class AppDelegate:
    UIResponder,
    UIApplicationDelegate,
    UNUserNotificationCenterDelegate
{
    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions
            launchOptions:
                [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        UNUserNotificationCenter.current().delegate =
            self

        UNUserNotificationCenter.current()
            .requestAuthorization(
                options: [
                    .alert,
                    .badge,
                    .sound
                ]
            ) {
                granted,
                error in

                if error != nil {
                    return
                }

                guard granted else {
                    return
                }

                DispatchQueue.main.async {
                    application
                        .registerForRemoteNotifications()
                }
            }

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken
            deviceToken: Data
    ) {
        let token =
            deviceToken
                .map {
                    String(
                        format: "%02x",
                        $0
                    )
                }
                .joined()

        UserDefaults.standard.set(
            token,
            forKey: "notia_apns_device_token"
        )

        print(
            "NOTIA_APNS_REGISTERED"
        )

    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError
            error: Error
    ) {
        print(
            "NOTIA_APNS_REGISTER_ERROR:",
            error.localizedDescription
        )

    }

    func applicationWillResignActive(
        _ application: UIApplication
    ) {}

    func applicationDidEnterBackground(
        _ application: UIApplication
    ) {}

    func applicationWillEnterForeground(
        _ application: UIApplication
    ) {}

    func applicationDidBecomeActive(
        _ application: UIApplication
    ) {}

    func applicationWillTerminate(
        _ application: UIApplication
    ) {}

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response:
            UNNotificationResponse,
        withCompletionHandler
            completionHandler:
                @escaping () -> Void
    ) {
        let userInfo =
            response.notification.request
                .content.userInfo

        let route =
            userInfo["route"] as? String
                ?? "/today"

        UserDefaults.standard.set(
            route,
            forKey:
                "notia_pending_push_route"
        )

        DispatchQueue.main.asyncAfter(
            deadline: .now() + 0.5
        ) {
            let pendingRoute =
                UserDefaults.standard.string(
                    forKey:
                        "notia_pending_push_route"
                )

            guard pendingRoute != nil else {
                return
            }

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

    func application(
        _ application: UIApplication,
        configurationForConnecting
            connectingSceneSession:
                UISceneSession,
        options:
            UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config =
            UISceneConfiguration(
                name:
                    "Default Configuration",
                sessionRole:
                    connectingSceneSession.role
            )

        config.delegateClass =
            SceneDelegate.self

        return config
    }
}
