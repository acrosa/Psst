import Foundation
import Security

/// Bearer token in the keychain, shared with the widget through the App Group
/// (app groups double as keychain access groups on iOS). The token is also the
/// better-auth session cookie value, so it signs the web canvas in too.
enum SessionStore {
	private static let service = "app.psst.session"

	static var bearerToken: String? {
		get { read(account: "bearer") }
		set { write(account: "bearer", value: newValue) }
	}

	static func clear() {
		bearerToken = nil
		// Legacy cookie entries from builds that stored them separately.
		write(account: "cookie", value: nil)
		write(account: "cookieName", value: nil)
	}

	private static func baseQuery(account: String) -> [String: Any] {
		[
			kSecClass as String: kSecClassGenericPassword,
			kSecAttrService as String: service,
			kSecAttrAccount as String: account,
			kSecAttrAccessGroup as String: Config.appGroup,
		]
	}

	private static func read(account: String) -> String? {
		var query = baseQuery(account: account)
		query[kSecReturnData as String] = true
		query[kSecMatchLimit as String] = kSecMatchLimitOne
		var result: AnyObject?
		guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
			let data = result as? Data
		else { return nil }
		return String(data: data, encoding: .utf8)
	}

	private static func write(account: String, value: String?) {
		let query = baseQuery(account: account)
		SecItemDelete(query as CFDictionary)
		guard let value, let data = value.data(using: .utf8) else { return }
		var attributes = query
		attributes[kSecValueData as String] = data
		attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
		let status = SecItemAdd(attributes as CFDictionary, nil)
		if status != errSecSuccess {
			// A silent failure here signs the user out on next launch — usually
			// a missing app-group entitlement (errSecMissingEntitlement, -34018).
			print("[keychain] write \(account) failed: \(status)")
			assertionFailure("keychain write failed (\(status)) — check entitlements")
		}
	}
}
