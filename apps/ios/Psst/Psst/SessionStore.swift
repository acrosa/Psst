import Foundation
import Security

/// Bearer token + web session cookie in the keychain, shared with the widget
/// through the App Group (app groups double as keychain access groups on iOS).
enum SessionStore {
	private static let service = "app.psst.session"

	static var bearerToken: String? {
		get { read(account: "bearer") }
		set { write(account: "bearer", value: newValue) }
	}

	/// The better-auth session cookie value, for signing the WKWebView in.
	static var sessionCookie: String? {
		get { read(account: "cookie") }
		set { write(account: "cookie", value: newValue) }
	}

	static var sessionCookieName: String? {
		get { read(account: "cookieName") }
		set { write(account: "cookieName", value: newValue) }
	}

	static func clear() {
		bearerToken = nil
		sessionCookie = nil
		sessionCookieName = nil
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
		SecItemAdd(attributes as CFDictionary, nil)
	}
}
