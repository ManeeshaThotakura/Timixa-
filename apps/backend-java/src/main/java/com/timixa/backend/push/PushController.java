package com.timixa.backend.push;

import com.timixa.backend.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    public record SubscriptionRequest(
        @NotBlank @Size(max = 500) String endpoint,
        @NotBlank @Size(max = 255) String p256dh,
        @NotBlank @Size(max = 255) String auth
    ) {}

    private final PushSubscriptionRepository subscriptions;
    private final PushSender sender;

    public PushController(PushSubscriptionRepository subscriptions, PushSender sender) {
        this.subscriptions = subscriptions;
        this.sender = sender;
    }

    @GetMapping("/public-key")
    public Map<String, String> publicKey() {
        return Map.of("publicKey", sender.publicKey());
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<Map<String, String>> subscribe(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody SubscriptionRequest req) {
        PushSubscription sub = subscriptions.findByEndpoint(req.endpoint())
            .orElseGet(PushSubscription::new);
        sub.setUserId(principal.id());
        sub.setEndpoint(req.endpoint());
        sub.setP256dh(req.p256dh());
        sub.setAuth(req.auth());
        subscriptions.save(sub);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("status", "subscribed"));
    }

    @DeleteMapping("/subscriptions")
    public ResponseEntity<Void> unsubscribe(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("endpoint") String endpoint) {
        subscriptions.deleteByUserIdAndEndpoint(principal.id(), endpoint);
        return ResponseEntity.noContent().build();
    }
}
