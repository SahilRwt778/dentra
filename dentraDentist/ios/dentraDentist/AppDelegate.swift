import UIKit
import livekit_react_native
import livekit_react_native_webrtc

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    LivekitReactNative.setup()
    WebRTCModuleOptions.sharedInstance().enableMultitaskingCameraAccess = true
    return true
  }
}
