# Thimphu HomeFinder User Guide

This guide explains how seekers find homes, how landlords manage listings and viewings, and how administrators review problems. Use the navigation links after signing in to open the tools available to your account.

Prices are in Bhutanese Ngultrum (BTN or Nu.). Viewing dates and times are shown in Bhutan time (UTC+6). A viewing acceptance arranges a visit; it does not reserve a home or create a tenancy.

## Getting started

You can browse homes, compare listings and plan move-in costs without an account. Choose Get started to register as a seeker or landlord, then sign in using your email and password. Administrator accounts are provisioned separately by the platform operator.

Use a password of at least 12 characters. The maximum is 72 UTF-8 bytes, so non-Latin characters can reach the limit sooner. Registration does not sign you in automatically. Sign out when you finish on a shared computer.

| Capability | Visitor | Seeker | Landlord | Admin |
| --- | --- | --- | --- | --- |
| Browse and compare public homes | Yes | Yes | Yes | Yes |
| Estimate move-in costs | Yes | Yes | Yes | Yes |
| Save favourites and request visits | No | Yes | No | No |
| Manage owned listings and photos | No | No | Yes | No |
| Accept or reject viewing requests | No | No | Own listings | No |
| Report a public listing | No | Yes | Yes | Yes |
| Review reports and manage accounts | No | No | No | Yes |
| Open own notification inbox | No | Yes | Yes | Yes |

Navigation changes with your role. Access to private pages also depends on your active account and ownership of the relevant record. You cannot register as an administrator, switch roles in the interface or manage another landlord's property.

## Seekers and visitors

### Find a suitable home

Open Browse homes. Filter by neighbourhood, minimum or maximum rent, bedrooms, move-in date, water or parking. Choose Most recent, Rent low to high or Rent high to low. Apply filters, use Reset to start again, and use Previous or Next when there are several pages. Filter settings appear in the URL, which you can bookmark or share.

Open a listing to see its photos, description, monthly rent, deposit, facilities, neighbourhood, landmarks and move-in date. Only currently public, available homes appear in public results. A listing may disappear after it is rented, hidden, archived, expired or its owner's account is suspended.

### Compare homes and plan your budget

Choose Compare home on up to three listings, then open Compare in the navigation. Compare rent, deposit, bedrooms, location, water, parking and move-in dates. On a narrow screen, scroll the table horizontally. Use Remove to free a slot and Refresh details to check the latest information.

Comparison selections are saved in this browser, including on shared computers. They do not sync to your account. Clearing browser data clears the selection. Unavailable homes show a message instead of their old details.

On a property page, use Plan your move-in budget. Select 1 to 12 months of rent and enter your own moving and utility setup estimates. The total includes that rent, the listed deposit and your estimates. Amounts must be non-negative with at most two decimal places. The calculator does not take payments; confirm actual charges with the landlord.

### Save a home and arrange a visit

Sign in as a seeker and choose Save this home. Open Favourites to revisit or remove saved homes. If a saved home becomes unavailable, you can still remove it, but its private details are not shown.

Choose a future Preferred date and time on a property page, add an optional message of up to 1,000 characters, and select Request viewing. Enter the time as Bhutan time, even if you are elsewhere. Open My viewings to see the request and View history to see its status changes.

The landlord can accept or reject a pending request. You can cancel your own pending or accepted request. Rejected and cancelled requests cannot be reopened; submit a new request for an available home if needed. Existing viewing history remains accessible if the listing later becomes unavailable.

## Landlords

### Create and maintain listings

Sign in as a landlord and open My properties. Choose Add a property and enter its title, description, monthly rent, deposit, bedrooms, neighbourhood, optional landmarks, water and parking availability, and move-in date. Save the property, then open Edit and photos to make corrections or add pictures.

Use accurate descriptions and photos of the actual property. The local demonstration homes contain illustrative images and fictional details; replace them with genuine listings before opening a public service.

### Manage property photos

Open Edit and photos for a property you own. Choose JPEG, PNG or WebP images and review their previews before uploading. The interface supports up to eight photos per property and at most 5 MiB per file; the server may impose lower configured limits. Upload progress and validation errors appear on the page.

Use the ordering controls to choose which image appears first on property cards. Remove images you no longer need. Wait for uploads to finish before leaving the page. If a request fails, refresh the photos before retrying so you can see which files were saved.

### Respond to viewings and availability changes

Open My viewings or Viewing requests from your dashboard. Read the proposed time and message, then accept or reject a pending request. View history shows the changes. The seeker receives an inbox update; a seeker cancellation also produces an update for you. This interface does not provide chat or automatic appointment rescheduling.

When a home is no longer available, choose Mark rented. Choose Mark available when it is available again. This does not override an administrator's hidden status or an expired listing. Existing viewing requests are not automatically cancelled when availability changes.

Archive removes a listing from public discovery and retains it in your records. Archived listings cannot be edited, renewed or reopened through the current interface. Use this action only when you are finished with the listing.

### Keep listings current

Choose Confirm expiring listings to review listings that have no expiry, are expired or expire within seven days. Confirmation currently records the time and sets expiry to 30 days from confirmation. It does not unhide a moderated listing or mark a rented home available. Newly created listings currently have no expiry until first confirmation. The team must agree on this renewal policy before public launch.

## Administrators

### Review reported listings

Open Administration, then Listing reports. Filter reports by Pending, Actioned, Dismissed or All reports. Review the concern, choose Review / manage visibility and enter a reason of 10 to 1,000 characters.

Use Hide listing to remove a misleading or unsuitable listing from public discovery. Use Unhide listing after resolving the issue. Visibility changes require confirmation and record the administrator, time and reason. Unhiding does not override rented status or expiry, and archived listings cannot be restored this way.

Record the report outcome separately with Mark actioned or Dismiss report. Reviewing a report alone does not hide or unhide its listing. Reviewed reports cannot be reopened through the current interface. The reporter receives a generic outcome notification; internal review reasons are not included in that notification.

The current moderation screen works from reported listings. It is not a general property-editing console. Administrators cannot impersonate landlords, edit their listing content or accept viewings on their behalf.

### Manage user accounts

Open User accounts from Administration. Use the available search and role/status filters to locate the account. Suspend or reactivate an account with a reason and confirm the change. You cannot suspend your own administrator account.

Suspension blocks the user's authenticated actions and removes a suspended landlord's homes from public discovery. Reactivation restores account access; existing rental, archive, moderation and expiry restrictions still apply. Account-status changes are recorded for audit.

Public registration cannot grant administrator access. The application does not provide account deletion, password resets or role promotion in the administration interface. Arrange these operational requirements with the platform team before launch.

## Inbox and troubleshooting

### Stay informed

Open Inbox after signing in. Viewing creation, acceptance, rejection and cancellation generate updates for the relevant recipient. Report review informs the reporter, and listing moderation informs the owner. Use Unread only, Mark as read, Refresh inbox and pagination to manage your own messages.

Updates appear after an event occurs; older events are not backfilled. The inbox refreshes when opened or when you choose Refresh inbox. Opening the related page does not mark a message read automatically. The current system does not send email, SMS, push notifications or automatic renewal reminders.

### Resolve common problems

- No homes found: reset the filters, widen the rent range or try a different neighbourhood.
- Listing unavailable: it may no longer be public. Refresh comparison details or choose another home.
- Session expired: sign in again, then retry the action. Your saved favourites remain linked to your account.
- Action not permitted: check that you are using the correct role and that your account is active.
- Too many attempts: wait before retrying. Repeated sign-in, viewing or reporting submissions are limited.
- Upload rejected: check the image type, file size, remaining photo slots and connection.
- Record changed: another action may already have updated it. Refresh before deciding what to do next.
- Forgotten password: self-service recovery is not yet available. The operator must provide a verified support and recovery process before launch.

### Report a concern

While signed in, open a public property and expand Report a problem with this listing. Explain the issue in 10 to 1,000 characters and choose Send report. Only one pending report per person per listing is allowed. Avoid including unnecessary personal information in reports or viewing messages.

The platform supports discovery and viewing arrangements. Online rent payments, tenancy contracts, identity verification badges, live chat and automatic calendar booking are not implemented. Agree on tenancy details directly with the landlord through the operator's supported process.
