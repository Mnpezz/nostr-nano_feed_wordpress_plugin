# Nostr Feed WordPress Plugin

A WordPress plugin that allows you to display posts from specified Nostr public keys (npubs) on your website, with support for both Lightning zaps and Nano cryptocurrency tips.

## Description

Nostr Feed is a WordPress plugin that integrates Nostr social network posts into your WordPress site. It allows you to display posts from specific Nostr users and enables both Lightning Network zaps and Nano cryptocurrency tips, providing flexible payment options for content creators.

## Features

- Display Nostr posts from multiple users
- Dual Payment Support:
  - Lightning Network zaps via WebLN
  - **Nano cryptocurrency tips via nano.to**
- Configurable relay connections
- Automatic URL detection and linking
- Image display support
- Clean, responsive design
- Configurable through WordPress admin panel
- Easy integration using shortcode
- Real-time updates from multiple Nostr relays

## Payment Features

### Lightning Zaps
- Send Bitcoin Lightning payments through WebLN-compatible wallets
- Supports NIP-57 zap requests
- Automatic LNURL handling
- Built-in payment verification

### Nano Tips (powered by nano.to)
- **Fast and feeless cryptocurrency payments**
- **Simple one-click tipping interface**
- **Automatic nano address detection from profiles**
- **Seamless integration with nano.to payment system**
- **No wallet setup required for recipients**

## Installation

1. Download the plugin files
2. Upload the plugin folder to the `/wp-content/plugins/` directory
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Configure the plugin settings

## Configuration

1. Go to WordPress admin panel
2. Navigate to Settings > Nostr Feed
3. Configure the following settings:
   - **Nostr Public Keys (npubs)**: Enter the Nostr public keys of the users whose posts you want to display
     - Enter one npub per line
     - Example format:
       ```
       npub1abc123...
       npub1xyz789...
       ```
   - **Nostr Relays**: Configure which relays to connect to
     - Enter one relay URL per line
     - Default relays:
       ```
       wss://relay.damus.io
       wss://relay.nostr.band
       wss://nos.lol
       ```
4. Click 'Save Changes'

## Usage

To display the Nostr feed on any page or post, use the shortcode:

```
[nostr_feed]
```

You can add this shortcode in:
- Posts
- Pages
- Widgets (if your theme supports shortcodes in widgets)
- Template files (using `do_shortcode()`)

## Payment Methods

### Using Lightning Zaps

1. Install a WebLN-compatible wallet (like [Alby](https://getalby.com))
2. Click the zap button on any post
3. Enter the amount you want to send
4. Confirm the payment in your wallet

### Using Nano Tips

1. Click the Nano tip button on any post
2. Enter the amount you want to send in NANO
3. Complete the payment using the nano.to interface
4. No wallet setup required - nano.to handles the payment flow

## Technical Details

The plugin connects to configured Nostr relays and:
- Fetches posts (kind 1 events)
- Supports image display
- Handles Lightning Network payments via LNURL
- **Integrates with nano.to for Nano payments**
- Implements NIP-57 for zaps
- Uses WebLN for Lightning payments

## Styling

The plugin comes with built-in styling that includes:
- Card-based post layout
- Sport-specific color coding
- Responsive design
- Image gallery support
- Hover effects
- Loading animations
- **Dual payment button design**

Custom CSS classes:
- `.nostr-post`: Individual post container
- `.nostr-post-content`: Post content area
- `.nostr-post-date`: Post date display
- `.nostr-posts`: Main feed container
- `.nostr-post-images`: Image gallery container
- `.nostr-zap-button`: Zap button
- `.nostr-nano-button`: Nano tip button

## Requirements

- WordPress 5.0 or higher
- PHP 7.0 or higher
- JavaScript enabled in the browser
- WebLN-compatible wallet for zaps (optional)
- **Internet connection for nano.to integration**

## Support

For support, feature requests, or bug reports, please visit the [GitHub repository](https://github.com/your-username/nostr-feed).

## License

This plugin is licensed under the GPL v2 or later.

## Changelog

### 1.0
- Initial release
- Basic Nostr feed functionality
- Admin configuration panel
- Shortcode implementation
- Lightning zap support
- **Nano cryptocurrency tipping support**
- Configurable relays
- Image display support