//
//  ViewController.swift
//  SOLS Calendar
//
import Cocoa
import SafariServices

private let extensionBundleIdentifier = "com.jimmyblackley.sols-calendar.Extension"
private let timetableURL = URL(
    string: "https://solss.uow.edu.au/sid/sols_tutorial_enrolment.my_timetable"
)!

final class ViewController: NSViewController {

    private let statusIcon = NSImageView()
    private let statusTitle = NSTextField(labelWithString: "Checking Safari…")
    private let statusDetail = NSTextField(
        wrappingLabelWithString: "Confirming whether the extension is enabled."
    )

    override func viewDidLoad() {
        super.viewDidLoad()
        buildInterface()
        refreshExtensionState()

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(refreshExtensionState),
            name: NSApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func buildInterface() {
        let root = NSStackView()
        root.orientation = .vertical
        root.alignment = .leading
        root.spacing = 16
        root.translatesAutoresizingMaskIntoConstraints = false

        let icon = NSImageView(image: NSApp.applicationIconImage)
        icon.imageScaling = .scaleProportionallyUpOrDown
        icon.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            icon.widthAnchor.constraint(equalToConstant: 64),
            icon.heightAnchor.constraint(equalToConstant: 64),
        ])

        let title = makeLabel(
            "SOLS Timetable to ICS",
            font: .systemFont(ofSize: 24, weight: .semibold)
        )
        let subtitle = makeLabel(
            "Export your UOW timetable as a standard calendar file.",
            font: .systemFont(ofSize: 13),
            color: .secondaryLabelColor
        )

        let headingText = NSStackView(views: [title, subtitle])
        headingText.orientation = .vertical
        headingText.alignment = .leading
        headingText.spacing = 4

        let heading = NSStackView(views: [icon, headingText])
        heading.orientation = .horizontal
        heading.alignment = .centerY
        heading.spacing = 16

        statusIcon.imageScaling = .scaleProportionallyUpOrDown
        statusIcon.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            statusIcon.widthAnchor.constraint(equalToConstant: 26),
            statusIcon.heightAnchor.constraint(equalToConstant: 26),
        ])

        statusTitle.font = .systemFont(ofSize: 14, weight: .semibold)
        statusDetail.font = .systemFont(ofSize: 12)
        statusDetail.textColor = .secondaryLabelColor

        let statusText = NSStackView(views: [statusTitle, statusDetail])
        statusText.orientation = .vertical
        statusText.alignment = .leading
        statusText.spacing = 2

        let statusRow = NSStackView(views: [statusIcon, statusText])
        statusRow.orientation = .horizontal
        statusRow.alignment = .centerY
        statusRow.spacing = 12
        let statusCard = makeCard(containing: statusRow)

        let instructionsTitle = makeLabel(
            "How to export",
            font: .systemFont(ofSize: 14, weight: .semibold)
        )
        let steps = NSStackView(views: [
            makeStep(
                number: 1,
                title: "Open My SOLS → My Timetable",
                detail: "Sign in to SOLS and open the timetable you want to export."
            ),
            makeStep(
                number: 2,
                title: "Choose the extension in Safari",
                detail: "Click SOLS Timetable to ICS in the Safari toolbar."
            ),
            makeStep(
                number: 3,
                title: "Export the ICS file",
                detail: "Choose the calendar year, then save the generated file."
            ),
        ])
        steps.orientation = .vertical
        steps.alignment = .leading
        steps.spacing = 12

        let instructions = NSStackView(views: [instructionsTitle, steps])
        instructions.orientation = .vertical
        instructions.alignment = .leading
        instructions.spacing = 12
        let instructionsCard = makeCard(containing: instructions)

        let openTimetableButton = makeButton(
            title: "Open SOLS Timetable",
            action: #selector(openTimetable)
        )
        openTimetableButton.keyEquivalent = "\r"
        openTimetableButton.bezelColor = .controlAccentColor

        let settingsButton = makeButton(
            title: "Manage Safari Extension…",
            action: #selector(openExtensionSettings)
        )

        let actions = NSStackView(views: [openTimetableButton, settingsButton])
        actions.orientation = .horizontal
        actions.alignment = .centerY
        actions.distribution = .fillEqually
        actions.spacing = 10

        let privacyIcon = NSImageView(
            image: NSImage(
                systemSymbolName: "lock.shield.fill",
                accessibilityDescription: "Privacy"
            ) ?? NSImage()
        )
        privacyIcon.contentTintColor = .systemGreen
        privacyIcon.imageScaling = .scaleProportionallyUpOrDown
        privacyIcon.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            privacyIcon.widthAnchor.constraint(equalToConstant: 24),
            privacyIcon.heightAnchor.constraint(equalToConstant: 24),
        ])

        let privacyTitle = makeLabel(
            "Your timetable stays on this Mac",
            font: .systemFont(ofSize: 13, weight: .semibold)
        )
        let privacyDetail = makeLabel(
            "Your timetable stays local. Opening the extension retrieves public dates from UOW.",
            font: .systemFont(ofSize: 12),
            color: .secondaryLabelColor
        )
        let privacyText = NSStackView(views: [privacyTitle, privacyDetail])
        privacyText.orientation = .vertical
        privacyText.alignment = .leading
        privacyText.spacing = 2

        let privacyRow = NSStackView(views: [privacyIcon, privacyText])
        privacyRow.orientation = .horizontal
        privacyRow.alignment = .centerY
        privacyRow.spacing = 12
        let privacyCard = makeCard(containing: privacyRow)

        let host = makeLabel(
            "SOLS timetable only · Public dates: www.uow.edu.au",
            font: .monospacedSystemFont(ofSize: 10.5, weight: .regular),
            color: .tertiaryLabelColor
        )
        let version = Bundle.main.object(
            forInfoDictionaryKey: "CFBundleShortVersionString"
        ) as? String ?? "1.0"
        let versionLabel = makeLabel(
            "Version \(version)",
            font: .systemFont(ofSize: 10.5),
            color: .tertiaryLabelColor
        )
        let footer = NSStackView(views: [host, NSView(), versionLabel])
        footer.orientation = .horizontal
        footer.alignment = .centerY

        [
            heading,
            statusCard,
            instructionsCard,
            actions,
            privacyCard,
            footer,
        ].forEach(root.addArrangedSubview)

        view.addSubview(root)

        NSLayoutConstraint.activate([
            root.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            root.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            root.topAnchor.constraint(equalTo: view.topAnchor, constant: 24),
            root.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -22),

            heading.widthAnchor.constraint(equalTo: root.widthAnchor),
            statusCard.widthAnchor.constraint(equalTo: root.widthAnchor),
            instructionsCard.widthAnchor.constraint(equalTo: root.widthAnchor),
            actions.widthAnchor.constraint(equalTo: root.widthAnchor),
            privacyCard.widthAnchor.constraint(equalTo: root.widthAnchor),
            footer.widthAnchor.constraint(equalTo: root.widthAnchor),
        ])
    }

    private func makeLabel(
        _ text: String,
        font: NSFont,
        color: NSColor = .labelColor
    ) -> NSTextField {
        let label = NSTextField(wrappingLabelWithString: text)
        label.font = font
        label.textColor = color
        label.maximumNumberOfLines = 0
        return label
    }

    private func makeCard(containing content: NSView) -> NSView {
        let card = NSVisualEffectView()
        card.material = .contentBackground
        card.blendingMode = .withinWindow
        card.state = .active
        card.wantsLayer = true
        card.layer?.cornerRadius = 11
        card.layer?.masksToBounds = true

        content.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(content)
        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            content.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
            content.topAnchor.constraint(equalTo: card.topAnchor, constant: 13),
            content.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -13),
        ])
        return card
    }

    private func makeStep(number: Int, title: String, detail: String) -> NSView {
        let symbol = NSImage(
            systemSymbolName: "\(number).circle.fill",
            accessibilityDescription: "Step \(number)"
        ) ?? NSImage()
        let numberView = NSImageView(image: symbol)
        numberView.contentTintColor = .controlAccentColor
        numberView.imageScaling = .scaleProportionallyUpOrDown
        numberView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            numberView.widthAnchor.constraint(equalToConstant: 22),
            numberView.heightAnchor.constraint(equalToConstant: 22),
        ])

        let titleLabel = makeLabel(
            title,
            font: .systemFont(ofSize: 12.5, weight: .medium)
        )
        let detailLabel = makeLabel(
            detail,
            font: .systemFont(ofSize: 11.5),
            color: .secondaryLabelColor
        )
        let text = NSStackView(views: [titleLabel, detailLabel])
        text.orientation = .vertical
        text.alignment = .leading
        text.spacing = 1

        let row = NSStackView(views: [numberView, text])
        row.orientation = .horizontal
        row.alignment = .top
        row.spacing = 10
        return row
    }

    private func makeButton(title: String, action: Selector) -> NSButton {
        let button = NSButton(title: title, target: self, action: action)
        button.bezelStyle = .rounded
        button.controlSize = .large
        return button
    }

    @objc private func refreshExtensionState() {
        statusIcon.image = NSImage(
            systemSymbolName: "ellipsis.circle.fill",
            accessibilityDescription: "Checking"
        )
        statusIcon.contentTintColor = .secondaryLabelColor
        statusTitle.stringValue = "Checking Safari…"
        statusDetail.stringValue = "Confirming whether the extension is enabled."

        SFSafariExtensionManager.getStateOfSafariExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] state, error in
            DispatchQueue.main.async {
                guard let self else { return }

                if let error {
                    self.statusIcon.image = NSImage(
                        systemSymbolName: "checkmark.seal.fill",
                        accessibilityDescription: "Extension installed"
                    )
                    self.statusIcon.contentTintColor = .controlAccentColor
                    self.statusTitle.stringValue = "Safari extension is installed"
                    self.statusDetail.stringValue =
                        "Open Safari Settings to confirm it is enabled for this profile."
                    NSLog(
                        "Unable to read Safari extension state: %@",
                        error.localizedDescription
                    )
                    return
                }

                let enabled = state?.isEnabled == true
                self.statusIcon.image = NSImage(
                    systemSymbolName: enabled
                        ? "checkmark.circle.fill"
                        : "exclamationmark.circle.fill",
                    accessibilityDescription: enabled
                        ? "Extension enabled"
                        : "Extension disabled"
                )
                self.statusIcon.contentTintColor = enabled ? .systemGreen : .systemOrange
                self.statusTitle.stringValue = enabled
                    ? "Safari extension is enabled"
                    : "Safari extension needs to be enabled"
                self.statusDetail.stringValue = enabled
                    ? "SOLS Timetable to ICS is ready to use."
                    : "Open Safari Settings and enable the extension to continue."
            }
        }
    }

    @objc private func openTimetable() {
        SFSafariApplication.openWindow(with: timetableURL) { [weak self] safariWindow in
            if safariWindow == nil {
                DispatchQueue.main.async {
                    self?.showError(
                        title: "Couldn’t Open SOLS",
                        message: "Safari did not create a window for the SOLS timetable."
                    )
                }
            }
        }
    }

    @objc private func openExtensionSettings() {
        SFSafariApplication.showPreferencesForExtension(
            withIdentifier: extensionBundleIdentifier
        ) { [weak self] error in
            if let error {
                DispatchQueue.main.async {
                    self?.showError(
                        title: "Couldn’t Open Safari Settings",
                        message: error.localizedDescription
                    )
                }
            }
        }
    }

    private func showError(title: String, message: String) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")

        if let window = view.window {
            alert.beginSheetModal(for: window)
        } else {
            alert.runModal()
        }
    }
}
