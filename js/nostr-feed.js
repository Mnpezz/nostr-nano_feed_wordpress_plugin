// First, let's add nostr-tools library (using a specific version known to work)
const nostrToolsScript = document.createElement('script');
nostrToolsScript.src = 'https://unpkg.com/nostr-tools@1.17.0/lib/nostr.bundle.js';
document.head.appendChild(nostrToolsScript);

nostrToolsScript.onload = async function() {
    // Wait for NostrTools to be available and initialized
    while (typeof window.NostrTools === 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    class NostrFeed {
        constructor() {
            const feedElement = document.getElementById('nostr-feed');
            // Get relays from data attribute or use defaults
            this.relays = feedElement ? 
                JSON.parse(feedElement.dataset.relays) : 
                [
                    'wss://relay.damus.io',
                    'wss://relay.nostr.band',
                    'wss://nos.lol'
                ];
            this.init();
        }

        async init() {
            const feedElement = document.getElementById('nostr-feed');
            if (!feedElement) return;

            const npubs = JSON.parse(feedElement.dataset.npubs);
            const postsContainer = feedElement.querySelector('.nostr-posts');

            // Convert npubs to hex pubkeys using nip19
            const pubkeys = npubs.map(npub => {
                try {
                    return window.NostrTools.nip19.decode(npub.trim()).data;
                } catch (e) {
                    console.error('Invalid npub:', npub, e);
                    return null;
                }
            }).filter(Boolean);

            try {
                // Create relay connections
                const relayConnections = await Promise.all(
                    this.relays.map(async url => {
                        const relay = window.NostrTools.relayInit(url);
                        try {
                            await relay.connect();
                            console.log(`Connected to ${url}`);
                            return relay;
                        } catch (err) {
                            console.log(`Failed to connect to ${url}:`, err);
                            return null;
                        }
                    })
                );

                // Filter out failed connections
                const activeRelays = relayConnections.filter(r => r !== null);

                if (activeRelays.length === 0) {
                    console.error('No relays connected');
                    return;
                }

                // Subscribe to events
                const filter = {
                    kinds: [1],
                    authors: pubkeys,
                    limit: 20
                };

                // Subscribe to each relay
                activeRelays.forEach(relay => {
                    let sub = relay.sub([filter]);

                    sub.on('event', event => {
                        this.renderPost(event, postsContainer);
                    });

                    sub.on('eose', () => {
                        console.log(`End of stored events from ${relay.url}`);
                    });
                });

            } catch (error) {
                console.error('Failed to initialize relays:', error);
            }
        }

        renderPost(event, container) {
            // Check if post already exists to avoid duplicates
            const existingPost = container.querySelector(`[data-event-id="${event.id}"]`);
            if (existingPost) return;

            const postElement = document.createElement('div');
            postElement.className = 'nostr-post';
            postElement.setAttribute('data-event-id', event.id);
            
            // Process content and extract images
            const { content, images } = this.processContent(event.content);
            const date = new Date(event.created_at * 1000).toLocaleString();

            // Create the post HTML
            let postHTML = `<div class="nostr-post-content">${content}</div>`;
            
            // Add images if any
            if (images.length > 0) {
                postHTML += '<div class="nostr-post-images">';
                images.forEach(img => {
                    postHTML += `
                        <div class="nostr-image-container">
                            <img src="${img}" alt="Post image" loading="lazy" />
                        </div>
                    `;
                });
                postHTML += '</div>';
            }

            // Add footer with date, zap button, and nano button
            postHTML += `
                <div class="nostr-post-footer">
                    <div class="nostr-post-date">${date}</div>
                    <div class="nostr-actions">
                        <button class="nostr-zap-button" data-event-id="${event.id}">
                            <svg class="zap-icon" viewBox="0 0 24 24">
                                <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12L11 3h1l-1 7h3.5c.49 0 .56.33.47.51l-4 10.49z"/>
                            </svg>
                            <span>Zap</span>
                        </button>
                        <button class="nostr-nano-button" data-event-id="${event.id}">
                            <svg class="nano-icon" viewBox="0 0 24 24">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                            <span>Tip Nano</span>
                        </button>
                    </div>
                </div>
            `;

            postElement.innerHTML = postHTML;

            // Add zap button click handler
            const zapButton = postElement.querySelector('.nostr-zap-button');
            zapButton.addEventListener('click', () => this.handleZap(event));

            // Add Nano button click handler
            const nanoButton = postElement.querySelector('.nostr-nano-button');
            nanoButton.addEventListener('click', () => this.handleNanoTip(event));

            container.insertBefore(postElement, container.firstChild);
        }

        processContent(content) {
            // Basic HTML escape
            content = content
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

            // Extract images
            const images = [];
            const imgRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|gif|png|webp))/gi;
            content = content.replace(imgRegex, (match) => {
                images.push(match);
                return ''; // Remove image URL from content
            });

            // Convert remaining URLs to links
            content = content.replace(
                /(https?:\/\/[^\s]+)/g,
                '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
            );

            // Convert line breaks
            content = content.replace(/\n/g, '<br>');

            return { content, images };
        }

        async getLightningInvoice(lnurl, amount, zapRequest) {
            try {
                let endpoint;
                
                // First check if it's a Lightning Address
                if (lnurl.includes('@')) {
                    const [name, domain] = lnurl.split('@');
                    endpoint = `https://${domain}/.well-known/lnurlp/${name}`;
                }
                console.log('LNURL endpoint:', endpoint);

                // Get LNURL pay endpoint info
                const proxyUrl = `${nostrFeedAjax.ajaxurl}?action=nostr_lnurl_proxy&nonce=${nostrFeedAjax.nonce}&url=${encodeURIComponent(endpoint)}`;
                const response = await fetch(proxyUrl);
                const data = await response.json();
                console.log('LNURL metadata response:', data);

                if (!data.success || !data.data || !data.data.callback) {
                    throw new Error('Invalid LNURL response - no callback URL');
                }

                const lnurlData = data.data;

                // Verify amount is within allowed range
                const amountMsats = amount * 1000;
                if (amountMsats < lnurlData.minSendable || amountMsats > lnurlData.maxSendable) {
                    throw new Error(`Amount must be between ${lnurlData.minSendable/1000} and ${lnurlData.maxSendable/1000} sats`);
                }

                // Verify the endpoint supports zaps
                if (!lnurlData.allowsNostr) {
                    throw new Error('This Lightning address does not support Nostr zaps');
                }

                // Verify nostrPubkey exists
                if (!lnurlData.nostrPubkey) {
                    throw new Error('Lightning address missing nostrPubkey');
                }

                // Get the invoice
                const callbackProxyUrl = `${nostrFeedAjax.ajaxurl}?action=nostr_callback_proxy&nonce=${nostrFeedAjax.nonce}`;
                const callbackResponse = await fetch(callbackProxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: lnurlData.callback,
                        amount: amountMsats,
                        nostr: zapRequest,
                        comment: '' // Include empty comment if commentAllowed exists
                    })
                });

                console.log('Callback request sent to:', lnurlData.callback);
                
                if (!callbackResponse.ok) {
                    const errorText = await callbackResponse.text();
                    console.error('Callback response error:', errorText);
                    throw new Error('Failed to get invoice');
                }

                const invoiceData = await callbackResponse.json();
                console.log('Invoice response:', invoiceData);

                if (!invoiceData.success || !invoiceData.data || !invoiceData.data.pr) {
                    console.error('Invalid invoice data:', invoiceData);
                    throw new Error('No payment request in response');
                }

                return invoiceData.data.pr;
            } catch (error) {
                console.error('Error getting lightning invoice:', error);
                throw error;
            }
        }

        async getProfileFromEvent(event) {
            try {
                // Try to get author's profile from relays
                const filter = {
                    kinds: [0],  // Kind 0 is the metadata event
                    authors: [event.pubkey],
                    limit: 1
                };

                for (const relay of this.relays) {
                    try {
                        const r = window.NostrTools.relayInit(relay);
                        await r.connect();
                        
                        let sub = r.sub([filter]);
                        
                        const profile = await new Promise((resolve, reject) => {
                            let timeout = setTimeout(() => {
                                sub.unsub();
                                reject(new Error('Profile fetch timeout'));
                            }, 5000);

                            sub.on('event', (event) => {
                                clearTimeout(timeout);
                                try {
                                    const profile = JSON.parse(event.content);
                                    console.log('Found profile:', profile);
                                    
                                    // Look for Nano address in about field or custom fields
                                    if (profile.about) {
                                        const nanoMatch = profile.about.match(/nano_[123456789abcdefghijkmnopqrstuwxyz]{60}/i);
                                        if (nanoMatch) {
                                            profile.nano_address = nanoMatch[0];
                                        }
                                    }
                                    
                                    // Also check for custom nano field
                                    if (profile.nano) {
                                        profile.nano_address = profile.nano;
                                    }
                                    
                                    sub.unsub();
                                    resolve(profile);
                                } catch (e) {
                                    reject(e);
                                }
                            });
                        });

                        await r.close();
                        
                        // Check if profile has lightning info
                        if (!profile.lud16 && !profile.lud06) {
                            console.log('Profile found but no lightning address:', profile);
                            continue;
                        }

                        // Log the Lightning address we found
                        console.log('Found Lightning address:', profile.lud16 || profile.lud06);
                        
                        return profile;
                    } catch (e) {
                        console.warn(`Failed to fetch profile from ${relay}:`, e);
                    }
                }
                throw new Error('No profile with Lightning address found');
            } catch (error) {
                console.error('Error getting profile:', error);
                throw error;
            }
        }

        async handleZap(event) {
            try {
                // Check if webln is available
                if (typeof window.webln === 'undefined') {
                    alert('Please install a WebLN provider (like Alby) to send zaps!');
                    return;
                }

                // Check if nostr is available
                if (typeof window.nostr === 'undefined') {
                    alert('Please install a Nostr provider (like Alby) to send zaps!');
                    return;
                }

                // Request permissions
                await window.webln.enable();
                const pubkey = await window.nostr.getPublicKey();
                console.log('Got pubkey:', pubkey); // Debug log

                // Get the author's profile to find their LN address
                console.log('Fetching profile for pubkey:', event.pubkey); // Debug log
                const authorProfile = await this.getProfileFromEvent(event);
                if (!authorProfile) {
                    alert('Could not find user\'s Lightning address');
                    return;
                }

                const lnurl = authorProfile.lud16 || authorProfile.lud06;
                if (!lnurl) {
                    alert('This user has not set up Lightning payments');
                    return;
                }

                console.log('Found Lightning address:', lnurl); // Debug log

                // Prompt for zap amount
                const amount = prompt('Enter amount in sats:', '1000');
                if (!amount) return; // User cancelled

                // Convert to number and validate
                const sats = parseInt(amount);
                if (isNaN(sats) || sats <= 0) {
                    alert('Please enter a valid amount');
                    return;
                }

                // Show loading state
                const zapButton = document.querySelector(`.nostr-zap-button[data-event-id="${event.id}"]`);
                if (zapButton) {
                    zapButton.classList.add('loading');
                }

                try {
                    // Create zap request event according to NIP-57
                    const zapRequest = {
                        kind: 9734,
                        created_at: Math.floor(Date.now() / 1000),
                        content: '', // Empty content as per most implementations
                        tags: [
                            ['p', event.pubkey],
                            ['e', event.id],
                            ['amount', (sats * 1000).toString()], // Convert to millisats
                            ['relays', ...this.relays],
                            // Add recommended optional tags
                            ['lnurl', await this.getLnurl(lnurl)], // Get bech32 encoded LNURL
                        ],
                        pubkey: pubkey // This is the sender's pubkey
                    };

                    // Get event hash and signature
                    zapRequest.id = window.NostrTools.getEventHash(zapRequest);
                    zapRequest.sig = await window.NostrTools.getSignature(zapRequest, await window.nostr.getPublicKey());

                    console.log('Created zap request:', zapRequest);

                    // Get the invoice using the properly formatted zap request
                    const invoice = await this.getLightningInvoice(lnurl, sats, zapRequest);
                    console.log('Got invoice:', invoice);

                    // Send payment
                    const response = await window.webln.sendPayment(invoice);
                    console.log('Payment sent:', response);
                    
                    // Show success message
                    alert(`Zap sent successfully! Amount: ${sats} sats`);
                } finally {
                    // Remove loading state
                    if (zapButton) {
                        zapButton.classList.remove('loading');
                    }
                }

            } catch (error) {
                console.error('Failed to send zap:', error);
                alert('Failed to send zap: ' + error.message);
            }
        }

        async handleNanoTip(event) {
            try {
                const profile = await this.getProfileFromEvent(event);
                if (!profile || !profile.nano_address) {
                    alert('This user has not set up Nano payments');
                    return;
                }

                // Prompt for amount
                const amount = prompt('Enter amount in NANO:', '0.133');
                if (!amount) return; // User cancelled

                // Use nano.to for payment
                NanoPay.open({
                    title: `Tip ${profile.name || 'User'}`,
                    address: profile.nano_address,
                    amount: parseFloat(amount),
                    success: (block) => {
                        console.log('Payment successful:', block);
                        alert(`Nano tip sent successfully! Amount: ${amount} NANO`);
                    },
                    cancel: () => {
                        console.log('Payment cancelled');
                    }
                });
            } catch (error) {
                console.error('Failed to send Nano tip:', error);
                alert('Failed to send Nano tip: ' + error.message);
            }
        }

        // Helper function to convert Lightning address to LNURL
        async getLnurl(lightningAddress) {
            if (!lightningAddress.includes('@')) {
                return lightningAddress; // Already an LNURL
            }

            const [name, domain] = lightningAddress.split('@');
            const url = `https://${domain}/.well-known/lnurlp/${name}`;
            
            // Convert URL to bech32 LNURL format
            // First convert to buffer
            const buffer = new TextEncoder().encode(url);
            // Convert to base64URL
            const base64url = btoa(String.fromCharCode(...buffer))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            
            // Return as LNURL
            return 'lnurl' + base64url.toLowerCase();
        }
    }

    // Initialize the feed
    new NostrFeed();
}; 