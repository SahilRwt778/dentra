import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import UIKit

class SceneDelegate: RCTDefaultReactNativeFactoryDelegate, UIWindowSceneDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }

    dependencyProvider = RCTAppDependencyProvider()
    reactNativeFactory = RCTReactNativeFactory(delegate: self)
    window = UIWindow(windowScene: windowScene)
    
    #if DEBUG
    let devMenuConfiguration = RCTDevMenuConfiguration(
      devMenuEnabled: true,
      shakeGestureEnabled: true,
      keyboardShortcutsEnabled: true
    )
    reactNativeFactory?.devMenuConfiguration = devMenuConfiguration
    #endif
    
    reactNativeFactory?.startReactNative(
      withModuleName: "dentraDentist",
      in: window,
      connectionOptions: connectionOptions
    )

   
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    RCTLinkingManager.scene(scene, openURLContexts: URLContexts)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    RCTLinkingManager.scene(scene, continue: userActivity)
  }

  override func bundleURL() -> URL? {
    #if DEBUG
    let provider = RCTBundleURLProvider.sharedSettings()
    let host = debugMetroHost(provider)
    provider.jsLocation = host

    // Use the dentist server directly; the default discovery can find the patient app on 8081.
    return provider.jsBundleURL(
      forBundleRoot: "index",
      packagerServerScheme: provider.packagerScheme,
      packagerServerHost: host,
      packagerOptionsUpdater: { $0 }
    )
    #else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }

  #if DEBUG
  private func debugMetroHost(_ provider: RCTBundleURLProvider) -> String {
    // Respect a custom host from the dev menu, including a physical device's LAN address.
    if let location = provider.jsLocation, !location.isEmpty {
      return location.contains(":") ? location : "\(location):8082"
    }

    let ipURL = Bundle.main.url(forResource: "ip", withExtension: "txt")
    let ip = ipURL.flatMap { try? String(contentsOf: $0, encoding: .utf8) }?
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let host = (ip?.isEmpty == false ? ip : nil) ?? "localhost"
    return "\(host):8082"
  }
  #endif
}
