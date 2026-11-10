package expo.modules.contactpicker

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract.CommonDataKinds.Phone
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val RC_PICK_PHONE = 4721

class PickerInProgressException :
  CodedException("ERR_PICKER_IN_PROGRESS", "A contact picker is already open", null)

class PickerUnavailableException :
  CodedException("ERR_PICKER_UNAVAILABLE", "No contacts app is available on this device", null)

/**
 * Opens the system contact picker filtered to phone numbers and returns the one
 * number (and its contact name) the user taps.
 *
 * Privacy / Play policy: this uses a narrowly scoped platform intent. The
 * contacts app grants us a temporary read permission on the single data row
 * the user picked - we never hold READ_CONTACTS and never see any other contact.
 */
class ContactPickerModule : Module() {
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ContactPicker")

    AsyncFunction("pickPhoneNumber") { promise: Promise ->
      if (pendingPromise != null) {
        throw PickerInProgressException()
      }
      val intent = Intent(Intent.ACTION_PICK).apply { type = Phone.CONTENT_TYPE }
      pendingPromise = promise
      try {
        appContext.throwingActivity.startActivityForResult(intent, RC_PICK_PHONE)
      } catch (e: ActivityNotFoundException) {
        pendingPromise = null
        promise.reject(PickerUnavailableException())
      }
    }

    OnActivityResult { _, payload ->
      val (requestCode, resultCode, data) = payload
      if (requestCode != RC_PICK_PHONE) return@OnActivityResult
      val promise = pendingPromise ?: return@OnActivityResult
      pendingPromise = null

      val uri = data?.data
      if (resultCode != Activity.RESULT_OK || uri == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        promise.resolve(readPickedRow(uri))
      } catch (e: Exception) {
        // A failed read is treated like a cancel - the user can still type the number.
        promise.resolve(null)
      }
    }
  }

  private fun readPickedRow(uri: Uri): Map<String, String?>? {
    val resolver = appContext.reactContext?.contentResolver ?: return null
    resolver.query(uri, arrayOf(Phone.NUMBER, Phone.DISPLAY_NAME), null, null, null)?.use { cursor ->
      if (!cursor.moveToFirst()) return null
      val number = cursor.getString(cursor.getColumnIndexOrThrow(Phone.NUMBER)) ?: return null
      val nameIdx = cursor.getColumnIndex(Phone.DISPLAY_NAME)
      val name = if (nameIdx >= 0) cursor.getString(nameIdx) else null
      return mapOf("phoneNumber" to number, "name" to name)
    }
    return null
  }
}
