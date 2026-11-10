Pod::Spec.new do |s|
  s.name           = 'ContactPicker'
  s.version        = '1.0.0'
  s.summary        = 'System contact picker for a single phone number (no contacts permission).'
  s.description    = 'Presents CNContactPickerViewController restricted to phone numbers. Runs out of process, so no NSContactsUsageDescription or permission prompt is needed.'
  s.author         = 'Chuma'
  s.homepage       = 'https://chuma.app'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
