import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard
            let windowScene =
                scene as? UIWindowScene
        else {
            return
        }

        let bridgeViewController =
            CAPBridgeViewController()

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
}
