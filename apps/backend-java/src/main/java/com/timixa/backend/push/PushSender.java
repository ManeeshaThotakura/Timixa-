package com.timixa.backend.push;

import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.Security;
import java.util.List;

@Service
public class PushSender {

    private static final Logger log = LoggerFactory.getLogger(PushSender.class);

    private final PushSubscriptionRepository subscriptions;
    private final String publicKey;
    private final PushService pushService;

    public PushSender(PushSubscriptionRepository subscriptions,
                      @Value("${app.push.public-key}") String publicKey,
                      @Value("${app.push.private-key}") String privateKey,
                      @Value("${app.push.subject}") String subject) throws Exception {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }
        this.subscriptions = subscriptions;
        this.publicKey = publicKey;
        this.pushService = new PushService(publicKey, privateKey, subject);
    }

    public String publicKey() {
        return publicKey;
    }

    /** Sends the payload to every subscription of the user; prunes dead endpoints. */
    public void sendToUser(java.util.UUID userId, String jsonPayload) {
        List<PushSubscription> subs = subscriptions.findByUserId(userId);
        for (PushSubscription s : subs) {
            try {
                Subscription target = new Subscription(
                    s.getEndpoint(), new Subscription.Keys(s.getP256dh(), s.getAuth()));
                var response = pushService.send(new Notification(target, jsonPayload));
                int status = response.getStatusLine().getStatusCode();
                if (status == 404 || status == 410) {
                    subscriptions.deleteByEndpoint(s.getEndpoint());
                    log.info("Pruned dead push subscription {}", s.getEndpoint());
                } else if (status >= 400) {
                    log.warn("Push send failed with status {} for {}", status, s.getEndpoint());
                }
            } catch (Exception e) {
                log.warn("Push send error for {}: {}", s.getEndpoint(), e.getMessage());
            }
        }
    }
}
