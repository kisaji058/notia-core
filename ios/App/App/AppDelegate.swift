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
