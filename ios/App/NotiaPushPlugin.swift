import Foundation
import Capacitor

@objc(NotiaPushPlugin)
public class NotiaPushPlugin:
    CAPPlugin,
    CAPBridgedPlugin
{
    public let identifier =
        "NotiaPushPlugin"

    public let jsName =
        "NotiaPush"

    public let pluginMethods:
        [CAPPluginMethod] = [
            CAPPluginMethod(
                name: "getDeviceToken",
                returnType:
                    CAPPluginReturnPromise
            ),
            CAPPluginMethod(
                name: "getPendingRoute",
                returnType:
                    CAPPluginReturnPromise
            )
        ]

    @objc func getDeviceToken(
        _ call: CAPPluginCall
    ) {
        let token =
            UserDefaults.standard.string(
                forKey:
                    "notia_apns_device_token"
            )

        call.resolve([
            "deviceToken":
                token as Any
        ])
    }

    @objc func getPendingRoute(
        _ call: CAPPluginCall
    ) {
        let key =
            "notia_pending_push_route"

        let route =
            UserDefaults.standard.string(
                forKey: key
            )

        UserDefaults.standard.removeObject(
            forKey: key
        )

        call.resolve([
            "route":
                route as Any
        ])
    }
}
