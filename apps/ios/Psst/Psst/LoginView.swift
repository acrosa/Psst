import AuthenticationServices
import SwiftUI

/// Sign in, the strict-minimal way: one left-aligned column — wordmark,
/// serif title, Apple first, email below. Liquid Glass on the controls.
struct LoginView: View {
	@Environment(AppState.self) private var appState

	@State private var email = ""
	@State private var password = ""
	@State private var name = ""
	@State private var registering = false
	@State private var busy = false
	@State private var error: String?

	var body: some View {
		ScrollView {
			VStack(alignment: .leading, spacing: 0) {
				Text("psst")
					.font(.system(size: 28, design: .serif))
					.italic()

				Text(registering ? "Make your first canvas" : "Welcome back")
					.font(.system(size: 34, design: .serif))
					.padding(.top, 40)

				Text(registering ? "Already have one?" : "New here?")
					.foregroundStyle(PsstColor.inkSoft)
					.font(.subheadline)
					.padding(.top, 8)
				Button(registering ? "Sign in instead" : "Make your first canvas") {
					registering.toggle()
					error = nil
				}
				.font(.subheadline)
				.foregroundStyle(PsstColor.accentDeep)

				if let error {
					Text(error)
						.font(.subheadline)
						.foregroundStyle(PsstColor.accentDeep)
						.padding(.top, 16)
				}

				SignInWithAppleButton(registering ? .signUp : .signIn) { request in
					request.requestedScopes = [.fullName, .email]
				} onCompletion: { result in
					handleApple(result)
				}
				.signInWithAppleButtonStyle(.black)
				.frame(height: 50)
				.clipShape(Capsule())
				.padding(.top, 32)

				HStack(spacing: 12) {
					Rectangle().fill(PsstColor.line).frame(height: 1)
					Text("or with email")
						.font(.caption)
						.foregroundStyle(PsstColor.inkFaint)
						.fixedSize()
					Rectangle().fill(PsstColor.line).frame(height: 1)
				}
				.padding(.vertical, 24)

				VStack(alignment: .leading, spacing: 16) {
					if registering {
						field("Name") {
							TextField("Sam", text: $name)
								.textContentType(.name)
						}
					}
					field("Email") {
						TextField("you@example.com", text: $email)
							.textContentType(.emailAddress)
							.keyboardType(.emailAddress)
							.textInputAutocapitalization(.never)
							.autocorrectionDisabled()
					}
					field("Password") {
						SecureField("8+ characters", text: $password)
							.textContentType(registering ? .newPassword : .password)
					}
				}

				Button {
					submitEmail()
				} label: {
					Text(busy ? "…" : registering ? "Create account" : "Sign in")
						.frame(maxWidth: .infinity)
						.frame(height: 50)
				}
				.buttonStyle(.glassProminent)
				.tint(PsstColor.accent)
				.disabled(busy || email.isEmpty || password.isEmpty || (registering && name.isEmpty))
				.padding(.top, 24)
			}
			.padding(.horizontal, 28)
			.padding(.vertical, 56)
			.frame(maxWidth: 420)
		}
		.scrollBounceBehavior(.basedOnSize)
		.background(PsstColor.paper)
		.foregroundStyle(PsstColor.ink)
		.task {
			#if DEBUG
				// Test hook: `SIMCTL_CHILD_PSST_TEST_EMAIL/…_PASSWORD` sign in on launch.
				let env = ProcessInfo.processInfo.environment
				if let testEmail = env["PSST_TEST_EMAIL"], let testPassword = env["PSST_TEST_PASSWORD"] {
					email = testEmail
					password = testPassword
					submitEmail()
				}
			#endif
		}
	}

	private func field(_ label: LocalizedStringKey, @ViewBuilder content: () -> some View) -> some View {
		VStack(alignment: .leading, spacing: 6) {
			Text(label)
				.font(.footnote.weight(.medium))
			content()
				.padding(.horizontal, 14)
				.frame(height: 46)
				.background(PsstColor.card, in: Capsule())
				.overlay(Capsule().stroke(PsstColor.line, lineWidth: 1))
		}
	}

	private func submitEmail() {
		busy = true
		error = nil
		Task {
			defer { busy = false }
			do {
				let api = PsstAPI()
				let session =
					registering
					? try await api.signUp(name: name, email: email, password: password)
					: try await api.signIn(email: email, password: password)
				appState.signedIn(with: session)
			} catch {
				self.error = error.localizedDescription
			}
		}
	}

	private func handleApple(_ result: Result<ASAuthorization, Error>) {
		guard case .success(let authorization) = result,
			let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
			let tokenData = credential.identityToken,
			let idToken = String(data: tokenData, encoding: .utf8)
		else { return }
		busy = true
		error = nil
		Task {
			defer { busy = false }
			do {
				let session = try await PsstAPI().signInWithApple(idToken: idToken)
				appState.signedIn(with: session)
			} catch {
				self.error = error.localizedDescription
			}
		}
	}
}
