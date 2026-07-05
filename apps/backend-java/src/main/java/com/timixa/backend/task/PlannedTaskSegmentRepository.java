package com.timixa.backend.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PlannedTaskSegmentRepository extends JpaRepository<PlannedTaskSegment, UUID> {

    List<PlannedTaskSegment> findByTaskIdAndSegmentDate(UUID taskId, LocalDate segmentDate);

    List<PlannedTaskSegment> findByTaskIdInAndSegmentDate(Collection<UUID> taskIds, LocalDate segmentDate);

    List<PlannedTaskSegment> findByTaskIdIn(Collection<UUID> taskIds);

    @Modifying
    @Transactional
    void deleteByTaskId(UUID taskId);
}
