//
//  SafariWebExtensionHandler.swift
//  SOLS Calendar Extension
//
import SafariServices

final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        // All timetable processing remains inside the Web Extension. The
        // containing app never receives or logs timetable data.
        context.completeRequest(returningItems: nil, completionHandler: nil)
    }

}
