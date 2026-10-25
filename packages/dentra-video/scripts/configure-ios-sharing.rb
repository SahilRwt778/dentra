require 'xcodeproj'
require 'fileutils'

# Keeps both Xcode projects consistent without hand-editing PBX identifiers.
root = File.expand_path('../../..', __dir__)
apps = [
  ['dentraDentist', 'dentraDentist', 'org.reactjs.native.example.dentraDentist'],
  ['dentra-mobile-patient', 'DentraMobilePatient', 'com.dentra.patient']
]

apps.each do |folder, app_name, bundle_id|
  ios = File.join(root, folder, 'ios')
  project = Xcodeproj::Project.open(File.join(ios, "#{app_name}.xcodeproj"))
  host = project.targets.find { |target| target.name == app_name }
  extension = project.targets.find { |target| target.name == 'DentraScreenShare' }
  extension ||= project.new_target(:app_extension, 'DentraScreenShare', :ios, '15.1')

  project.build_configurations.each do |configuration|
    configuration.build_settings['DENTRA_SCREEN_SHARE_GROUP'] ||= "group.#{bundle_id}.screenshare"
  end

  host.build_configurations.each do |configuration|
    configuration.build_settings['CODE_SIGN_ENTITLEMENTS'] ||= "#{app_name}/#{app_name}.entitlements"
    path = File.join(ios, configuration.build_settings['CODE_SIGN_ENTITLEMENTS'])
    entitlements = File.exist?(path) ? Xcodeproj::Plist.read_from_path(path) : {}
    entitlements['com.apple.security.application-groups'] = ['$(DENTRA_SCREEN_SHARE_GROUP)']
    Xcodeproj::Plist.write_to_path(entitlements, path)
  end
  info_path = File.join(ios, app_name, 'Info.plist')
  info = Xcodeproj::Plist.read_from_path(info_path)
  info.delete('DentraScreenShareAppGroup')
  info.delete('DentraScreenShareExtension')
  info['RTCAppGroupIdentifier'] = '$(DENTRA_SCREEN_SHARE_GROUP)'
  info['RTCScreenSharingExtension'] = "#{bundle_id}.ScreenShare"
  Xcodeproj::Plist.write_to_path(info, info_path)

  directory = File.join(ios, 'DentraScreenShare')
  FileUtils.mkdir_p(directory)
  Xcodeproj::Plist.write_to_path({
    'CFBundleDisplayName' => 'Dentra Screen Share',
    'CFBundleExecutable' => '$(EXECUTABLE_NAME)',
    'CFBundleIdentifier' => '$(PRODUCT_BUNDLE_IDENTIFIER)',
    'CFBundleInfoDictionaryVersion' => '6.0',
    'CFBundleName' => '$(PRODUCT_NAME)',
    'CFBundlePackageType' => 'XPC!',
    'CFBundleShortVersionString' => '$(MARKETING_VERSION)',
    'CFBundleVersion' => '$(CURRENT_PROJECT_VERSION)',
    'RTCAppGroupIdentifier' => '$(DENTRA_SCREEN_SHARE_GROUP)',
    'NSExtension' => {
      'NSExtensionPointIdentifier' => 'com.apple.broadcast-services-upload',
      'NSExtensionPrincipalClass' => '$(PRODUCT_MODULE_NAME).SampleHandler',
      'NSExtensionAttributes' => { 'RPBroadcastProcessMode' => 'RPBroadcastProcessModeSampleBuffer' }
    }
  }, File.join(directory, 'Info.plist'))
  Xcodeproj::Plist.write_to_path({
    'com.apple.security.application-groups' => ['$(DENTRA_SCREEN_SHARE_GROUP)']
  }, File.join(directory, 'DentraScreenShare.entitlements'))

  extension.build_configurations.each do |configuration|
    configuration.build_settings.merge!({
      'PRODUCT_NAME' => '$(TARGET_NAME)',
      'INFOPLIST_FILE' => 'DentraScreenShare/Info.plist',
      'PRODUCT_BUNDLE_IDENTIFIER' => "#{bundle_id}.ScreenShare",
      'CODE_SIGN_ENTITLEMENTS' => 'DentraScreenShare/DentraScreenShare.entitlements',
      'SWIFT_VERSION' => '5.0',
      'IPHONEOS_DEPLOYMENT_TARGET' => '15.1',
      'TARGETED_DEVICE_FAMILY' => '1,2',
      'SKIP_INSTALL' => 'YES',
      'APPLICATION_EXTENSION_API_ONLY' => 'YES',
      'MARKETING_VERSION' => '1.0',
      'CURRENT_PROJECT_VERSION' => '1',
      'LD_RUNPATH_SEARCH_PATHS' => '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
    })
  end

  # Remove only the former provider's extension source references.
  old_group = project.main_group.groups.find { |group| group.name == 'ChimeBroadcastSources' }
  if old_group
    old_group.files.each { |file| file.remove_from_project }
    old_group.remove_from_project
  end
  group = project.main_group.find_subpath('LiveKitBroadcastSources', true)
  %w[SampleHandler.swift SampleUploader.swift SocketConnection.swift Atomic.swift DarwinNotificationCenter.swift].each do |file|
    path = "../../packages/dentra-video/broadcast/#{file}"
    reference = group.files.find { |entry| entry.path == path } || group.new_file(path)
    unless extension.source_build_phase.files_references.include?(reference)
      extension.source_build_phase.add_file_reference(reference)
    end
  end
  framework = project.frameworks_group.files.find { |entry| entry.path == 'System/Library/Frameworks/ReplayKit.framework' }
  framework ||= project.frameworks_group.new_file('System/Library/Frameworks/ReplayKit.framework', :sdk_root)
  extension.frameworks_build_phase.add_file_reference(framework) unless extension.frameworks_build_phase.files_references.include?(framework)
  host.add_dependency(extension) unless host.dependencies.any? { |entry| entry.target == extension }
  embed = host.copy_files_build_phases.find { |phase| phase.name == 'Embed App Extensions' }
  embed ||= host.new_copy_files_build_phase('Embed App Extensions')
  embed.dst_subfolder_spec = '13'
  # Firebase's Info.plist script must run after extension embedding to avoid a build cycle.
  host.build_phases.delete(embed)
  host.build_phases.insert(host.build_phases.index(host.frameworks_build_phase) + 1, embed)
  unless embed.files_references.include?(extension.product_reference)
    embed.add_file_reference(extension.product_reference).settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }
  end
  project.save

  puts "Configured #{app_name} and its screen-sharing extension."
end
