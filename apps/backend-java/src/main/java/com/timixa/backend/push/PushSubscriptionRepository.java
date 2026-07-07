package com.timixa.backend.push;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    List<PushSubscription> findByUserId(UUID userId);

    Optional<PushSubscription> findByEndpoint(String endpoint);

    @Modifying
    @Transactional
    void deleteByEndpoint(String endpoint);

    @Modifying
    @Transactional
    void deleteByUserIdAndEndpoint(UUID userId, String endpoint);
}
