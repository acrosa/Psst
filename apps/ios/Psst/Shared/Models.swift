import Foundation

// The /api/v1 payloads (docs/NATIVE_IOS.md §4). Shapes mirror the web's
// services one to one; apps/ios/Psst/Fixtures/*.json — written by the
// e2e spec against the real server — are the contract.

enum Role: String, Decodable, Sendable {
	case owner
	case member
}

/// A person at the table.
struct Member: Decodable, Identifiable, Equatable, Sendable {
	let id: String
	let name: String?
	let image: String?
	let role: Role
}

/// `GET /api/v1/me` — who's here, where they can go, how to show the board.
struct Me: Decodable, Sendable {
	let user: Person
	let waitlisted: Bool
	let spaces: [SpaceSummary]
	let flags: Flags

	struct Person: Decodable, Sendable {
		let id: String
		let name: String?
		let email: String
		let image: String?
	}

	struct Flags: Decodable, Sendable {
		/// `auto` · `on` · `off` — the server's say over the native board.
		let nativeBoard: String
	}
}

/// A space in the list: who's there and how full today is.
struct SpaceSummary: Decodable, Identifiable, Equatable, Sendable {
	let id: String
	let name: String
	let emoji: String
	let timezone: String
	let role: Role
	let members: [Member]
	let todayCount: Int
}

struct SpaceInfo: Decodable, Equatable, Sendable {
	let id: String
	let name: String
	let emoji: String
	/// Absent where the web omits it (the timeline).
	let timezone: String?
}

/// `GET /api/v1/spaces/:id/board` and `…/days/:date`.
struct BoardPayload: Decodable, Equatable, Sendable {
	let space: SpaceInfo
	let role: Role
	let members: [Member]
	let board: Board
	/// How often to look again (today's board only).
	let pollMs: Int?
}

struct Board: Decodable, Equatable, Sendable {
	/// `YYYY-MM-DD` in the space's timezone.
	let date: String
	/// Past days are keepsakes: read everything, change nothing.
	let frozen: Bool
	let items: [CanvasItem]
	let shareToken: String?
}

/// One keepsake on the board, positioned in board points (1 web px = 1 pt).
struct CanvasItem: Decodable, Identifiable, Equatable, Sendable {
	enum Kind: String, Sendable {
		case link, note, image, emoji, drawing, audio, letter
	}

	let id: String
	/// Raw type, kept as a string so a new kind from the server never breaks
	/// decoding the whole board — `kind` is nil for what this build can't draw.
	let type: String
	let url: String?
	let text: String?
	let x: Double
	let y: Double
	let z: Int
	let rotation: Double
	let scale: Double
	let authorId: String
	let authorName: String?
	/// ISO 8601 with fractional seconds (JS toISOString).
	let createdAt: String
	let unfurl: Unfurl?
	let assets: [Asset]
	let comments: [Comment]
	let reactions: [Reaction]
	/// The Sunday letter, pre-drawn by the server (letters only).
	let letter: LetterInk?

	var kind: Kind? { Kind(rawValue: type) }

	struct Unfurl: Decodable, Equatable, Sendable {
		enum Status: String, Decodable, Sendable {
			case pending, ok, failed
		}

		let title: String?
		let description: String?
		let imageUrl: String?
		let faviconUrl: String?
		let siteName: String?
		let status: Status
	}

	struct Asset: Decodable, Equatable, Sendable {
		/// `original` or `thumb`.
		let kind: String
		let url: String
		let width: Int?
		let height: Int?
		let blurhash: String?
	}

	struct Comment: Decodable, Identifiable, Equatable, Sendable {
		let id: String
		let authorId: String
		let authorName: String?
		let authorImage: String?
		let text: String
		let createdAt: String
	}

	struct Reaction: Decodable, Equatable, Sendable {
		let emoji: String
		let userId: String
	}
}

/// The letter's hand: an SVG path (M/L/Z) in the sheet's mm space.
struct LetterInk: Decodable, Equatable, Sendable {
	let d: String
	let width: Double
	let height: Double
	/// "the week of September 21" — what the back's postmark says.
	let postmark: String
}

/// `GET /api/v1/spaces/:id/days` — the scrapbook.
struct DaysPayload: Decodable, Sendable {
	let space: SpaceInfo
	let days: [TimelineDay]
	/// Pass as `before` for the next page; nil at the first day.
	let nextBefore: String?
}

struct TimelineDay: Decodable, Identifiable, Equatable, Sendable {
	let date: String
	let count: Int
	let peeks: [DayPeek]

	var id: String { date }
}

/// A glimpse of what a past day holds.
enum DayPeek: Decodable, Equatable, Sendable {
	case note(String)
	case emoji(String)
	case letter
	case link(imageUrl: String?)
	case image(imageUrl: String?)
	case unknown

	private enum CodingKeys: String, CodingKey {
		case type, text, emoji, imageUrl
	}

	init(from decoder: Decoder) throws {
		let c = try decoder.container(keyedBy: CodingKeys.self)
		switch try c.decode(String.self, forKey: .type) {
		case "note": self = try .note(c.decodeIfPresent(String.self, forKey: .text) ?? "")
		case "emoji": self = try .emoji(c.decodeIfPresent(String.self, forKey: .emoji) ?? "✨")
		case "letter": self = .letter
		case "link": self = try .link(imageUrl: c.decodeIfPresent(String.self, forKey: .imageUrl))
		case "image": self = try .image(imageUrl: c.decodeIfPresent(String.self, forKey: .imageUrl))
		default: self = .unknown
		}
	}
}

/// `GET /api/v1/spaces/:id` — the settings page, as data.
struct SpaceSettings: Decodable, Sendable {
	let role: Role
	let space: SpaceInfo
	let members: [Member]
	let invites: [PendingInvite]

	struct PendingInvite: Decodable, Identifiable, Sendable {
		let id: String
		let email: String?
		let createdAt: String
	}
}

/// The outcome of walking through an invite link.
struct InviteAcceptance: Decodable, Sendable {
	/// `joined` · `already-member`, or the sad ones: `invalid` · `expired` · `used` · `full`.
	let status: String
	let spaceId: String?
	let error: String?
}
