<?php
/*
Plugin Name: Nostr+Nano Feed
Description: Display posts from specified Nostr npubs
Version: 2.0
Author: mnpezz
License: GPL v2 or later
*/

if (!defined('ABSPATH')) {
    exit;
}

class NostrFeed {
    private $options;

    public function __construct() {
        add_action('admin_menu', array($this, 'add_plugin_page'));
        add_action('admin_init', array($this, 'page_init'));
        add_shortcode('nostr_feed', array($this, 'render_feed'));
        
        // Add action to enqueue scripts and styles
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts_and_styles'));
        
        // Add AJAX endpoints for LNURL proxy
        add_action('wp_ajax_nostr_lnurl_proxy', array($this, 'handle_lnurl_proxy'));
        add_action('wp_ajax_nostr_callback_proxy', array($this, 'handle_callback_proxy'));
        add_action('wp_ajax_nostr_lnurl_callback', array($this, 'handle_lnurl_callback'));
        
        // Also allow non-logged-in users
        add_action('wp_ajax_nostr_lnurl_proxy', array($this, 'handle_lnurl_proxy'));
        add_action('wp_ajax_nostr_callback_proxy', array($this, 'handle_callback_proxy'));
        add_action('wp_ajax_nostr_lnurl_callback', array($this, 'handle_lnurl_callback'));
        
        // Load options
        $this->options = get_option('nostr_feed_options');
    }

    public function enqueue_scripts_and_styles() {
        // Enqueue CSS with versioning for cache busting
        wp_enqueue_style(
            'nostr-feed-styles',
            plugin_dir_url(__FILE__) . 'css/nostr-feed.css',
            array(),
            filemtime(plugin_dir_path(__FILE__) . 'css/nostr-feed.css')
        );

        // Enqueue JavaScript
        wp_enqueue_script(
            'nostr-feed',
            plugin_dir_url(__FILE__) . 'js/nostr-feed.js',
            array(),
            filemtime(plugin_dir_path(__FILE__) . 'js/nostr-feed.js'),
            true
        );

        // Add AJAX URL to JavaScript
        wp_localize_script('nostr-feed', 'nostrFeedAjax', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('nostr-feed-nonce')
        ));

        // Add NanoPay.js
        wp_enqueue_script(
            'nanopay',
            'https://pay.nano.to/latest.js',
            array(),
            null,
            true
        );
    }

    public function add_plugin_page() {
        add_options_page(
            'Nostr Feed Settings',
            'Nostr Feed',
            'manage_options',
            'nostr-feed',
            array($this, 'create_admin_page')
        );
    }

    public function create_admin_page() {
        ?>
        <div class="wrap">
            <h1>Nostr Feed Settings</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('nostr_feed_options_group');
                do_settings_sections('nostr-feed-admin');
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    public function page_init() {
        register_setting(
            'nostr_feed_options_group',
            'nostr_feed_options',
            array($this, 'sanitize')
        );

        add_settings_section(
            'nostr_feed_setting_section',
            'Nostr Settings',
            array($this, 'section_info'),
            'nostr-feed-admin'
        );

        add_settings_field(
            'npub_list',
            'Nostr Public Keys (npubs)',
            array($this, 'npub_list_callback'),
            'nostr-feed-admin',
            'nostr_feed_setting_section'
        );

        // Add relay list field
        add_settings_field(
            'relay_list',
            'Nostr Relays',
            array($this, 'relay_list_callback'),
            'nostr-feed-admin',
            'nostr_feed_setting_section'
        );
    }

    public function sanitize($input) {
        $new_input = array();
        if(isset($input['npub_list']))
            $new_input['npub_list'] = sanitize_textarea_field($input['npub_list']);
        if(isset($input['relay_list']))
            $new_input['relay_list'] = sanitize_textarea_field($input['relay_list']);
        return $new_input;
    }

    public function section_info() {
        print 'Enter your settings below:';
    }

    public function npub_list_callback() {
        printf(
            '<textarea class="large-text" rows="5" name="nostr_feed_options[npub_list]" id="npub_list">%s</textarea>',
            isset($this->options['npub_list']) ? esc_attr($this->options['npub_list']) : ''
        );
        echo '<p class="description">Enter one npub per line</p>';
    }

    public function relay_list_callback() {
        $default_relays = "wss://relay.damus.io\nwss://relay.nostr.band\nwss://nos.lol";
        printf(
            '<textarea class="large-text" rows="5" name="nostr_feed_options[relay_list]" id="relay_list">%s</textarea>',
            isset($this->options['relay_list']) ? esc_attr($this->options['relay_list']) : $default_relays
        );
        echo '<p class="description">Enter one relay URL per line (e.g., wss://relay.damus.io)</p>';
    }

    public function render_feed($atts) {
        $npubs = isset($this->options['npub_list']) ? 
                 explode("\n", str_replace("\r", "", $this->options['npub_list'])) : 
                 array();
        
        // Get relays from options or use defaults
        $relays = isset($this->options['relay_list']) ? 
                 explode("\n", str_replace("\r", "", $this->options['relay_list'])) : 
                 array('wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol');
        
        $output = '<div id="nostr-feed" data-npubs="' . esc_attr(json_encode($npubs)) . '" ';
        $output .= 'data-relays="' . esc_attr(json_encode($relays)) . '">';
        $output .= '<div class="nostr-posts"></div>';
        $output .= '</div>';
        
        return $output;
    }

    // Handle LNURL proxy requests
    public function handle_lnurl_proxy() {
        check_ajax_referer('nostr-feed-nonce', 'nonce');
        
        $url = isset($_GET['url']) ? esc_url_raw($_GET['url']) : '';
        if (empty($url)) {
            wp_send_json_error('Invalid URL');
            return;
        }

        $response = wp_remote_get($url);
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
            return;
        }

        $body = wp_remote_retrieve_body($response);
        wp_send_json_success(json_decode($body));
    }

    // Handle callback proxy requests
    public function handle_callback_proxy() {
        check_ajax_referer('nostr-feed-nonce', 'nonce');
        
        // Get POST data
        $json_data = file_get_contents('php://input');
        $data = json_decode($json_data, true);
        
        if (!$data || !isset($data['url']) || !isset($data['amount']) || !isset($data['nostr'])) {
            wp_send_json_error('Invalid parameters');
            return;
        }

        $url = $data['url'];
        $amount = intval($data['amount']);
        $nostr = $data['nostr'];

        // Build callback URL
        $callback_url = add_query_arg(
            array(
                'amount' => $amount,
                'nostr' => $nostr,
            ),
            $url
        );

        // Make the request to the LNURL callback
        $response = wp_remote_get($callback_url, array(
            'timeout' => 30,
            'headers' => array(
                'Accept' => 'application/json',
            )
        ));
        
        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
            return;
        }

        $response_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        
        error_log('LNURL callback response: ' . print_r(array(
            'url' => $callback_url,
            'code' => $response_code,
            'body' => $body
        ), true));

        if ($response_code !== 200) {
            wp_send_json_error('Callback returned status ' . $response_code . ': ' . $body);
            return;
        }

        $decoded_body = json_decode($body);
        if (!$decoded_body || !isset($decoded_body->pr)) {
            wp_send_json_error('Invalid response from callback: ' . $body);
            return;
        }

        wp_send_json_success($decoded_body);
    }
}

$nostr_feed = new NostrFeed(); 