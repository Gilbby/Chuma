import ContactsUI
import ExpoModulesCore

internal final class PickerInProgressException: Exception {
  override var reason: String { "A contact picker is already open" }
}

internal final class NoViewControllerException: Exception {
  override var reason: String { "Could not find a view controller to present the contact picker" }
}

/**
 * Presents Apple's CNContactPickerViewController restricted to phone numbers and
 * returns the one number (and contact name) the user taps.
 *
 * The picker runs out of process: the app only receives the property the user
 * selects, so no Contacts authorization, NSContactsUsageDescription or prompt
 * is required.
 */
public final class ContactPickerModule: Module {
  private var pendingPromise: Promise?
  private var pickerDelegate: PhonePickerDelegate?

  public func definition() -> ModuleDefinition {
    Name("ContactPicker")

    AsyncFunction("pickPhoneNumber") { (promise: Promise) in
      if self.pendingPromise != nil {
        throw PickerInProgressException()
      }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        throw NoViewControllerException()
      }

      let picker = CNContactPickerViewController()
      picker.displayedPropertyKeys = [CNContactPhoneNumbersKey]
      // Grey out contacts with no number. Tapping a contact opens its card and
      // the user taps the specific number they want.
      picker.predicateForEnablingContact = NSPredicate(format: "phoneNumbers.@count > 0")
      picker.predicateForSelectionOfContact = NSPredicate(value: false)
      picker.predicateForSelectionOfProperty = NSPredicate(format: "key == 'phoneNumbers'")

      let delegate = PhonePickerDelegate { [weak self] result in
        self?.pendingPromise?.resolve(result)
        self?.pendingPromise = nil
        self?.pickerDelegate = nil
      }
      self.pickerDelegate = delegate
      self.pendingPromise = promise
      picker.delegate = delegate

      presenter.present(picker, animated: true)
    }.runOnQueue(.main)
  }
}

private final class PhonePickerDelegate: NSObject, CNContactPickerDelegate {
  private let onFinish: ([String: Any?]?) -> Void

  init(onFinish: @escaping ([String: Any?]?) -> Void) {
    self.onFinish = onFinish
  }

  func contactPicker(_ picker: CNContactPickerViewController, didSelect contactProperty: CNContactProperty) {
    guard let phone = contactProperty.value as? CNPhoneNumber else {
      onFinish(nil)
      return
    }
    let contact = contactProperty.contact
    var result: [String: Any] = ["phoneNumber": phone.stringValue]
    if contact.isKeyAvailable(CNContactGivenNameKey) && contact.isKeyAvailable(CNContactFamilyNameKey) {
      let full = "\(contact.givenName) \(contact.familyName)".trimmingCharacters(in: .whitespaces)
      if !full.isEmpty { result["name"] = full }
    }
    onFinish(result)
  }

  func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
    onFinish(nil)
  }
}
