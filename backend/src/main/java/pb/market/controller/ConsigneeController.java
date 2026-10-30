package pb.market.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import pb.market.entity.Consignee;
import pb.market.repository.ConsigneeRepository;

import java.util.List;

@RestController
@RequestMapping("/api/consignees")
@RequiredArgsConstructor
@CrossOrigin
public class ConsigneeController {

    private final ConsigneeRepository consigneeRepository;
    private final pb.market.repository.BranchRepository branchRepository;

    @GetMapping
    public List<Consignee> getAllConsignees(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false, defaultValue = "false") Boolean onlyHq,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
            onlyHq = false;
        } else if (branchId != null && (branchId == 0L || branchId == -1L)) {
            onlyHq = true;
            branchId = null;
        }
        return consigneeRepository.findAllByBranchOrHq(branchId, Boolean.TRUE.equals(onlyHq));
    }

    @PostMapping
    public Consignee addConsignee(
            @RequestBody Consignee consignee,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (consignee.getName() == null || consignee.getName().trim().isEmpty()) {
            throw new IllegalArgumentException("Consignee name is required.");
        }
        boolean isBranchUser = user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()));
        if (isBranchUser) {
            Long bId = user.getBranchId();
            if (bId != null) {
                branchRepository.findById(bId).ifPresent(consignee::setBranch);
            }
        } else {
            Long resolvedBranchId = null;
            if (branchId != null) {
                resolvedBranchId = branchId;
            } else if (consignee.getBranch() != null && consignee.getBranch().getId() != null) {
                resolvedBranchId = consignee.getBranch().getId();
            }

            if (resolvedBranchId != null && resolvedBranchId > 0) {
                branchRepository.findById(resolvedBranchId).ifPresent(consignee::setBranch);
            } else {
                // Main Admin (Central HQ)
                consignee.setBranch(null);
            }
        }
        return consigneeRepository.save(consignee);
    }

    @PutMapping("/{id}")
    public Consignee updateConsignee(
            @PathVariable("id") Long id,
            @RequestBody Consignee updated,
            @RequestParam(required = false) Long branchId,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        Consignee consignee = consigneeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Consignee not found."));
        if (updated.getName() != null && !updated.getName().trim().isEmpty()) {
            consignee.setName(updated.getName().trim());
        }
        if (updated.getContactInfo() != null) {
            consignee.setContactInfo(updated.getContactInfo().trim());
        }

        boolean isBranchUser = user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()));
        if (!isBranchUser) {
            Long resolvedBranchId = null;
            boolean branchSpecified = false;

            if (branchId != null) {
                resolvedBranchId = branchId;
                branchSpecified = true;
            } else if (updated.getBranch() != null) {
                resolvedBranchId = updated.getBranch().getId();
                branchSpecified = true;
            }

            if (branchSpecified) {
                if (resolvedBranchId != null && resolvedBranchId > 0) {
                    branchRepository.findById(resolvedBranchId).ifPresent(consignee::setBranch);
                } else {
                    // Set to Main Admin
                    consignee.setBranch(null);
                }
            }
        }

        return consigneeRepository.save(consignee);
    }

    @DeleteMapping("/{id}")
    public org.springframework.http.ResponseEntity<?> deleteConsignee(@PathVariable("id") Long id) {
        if (!consigneeRepository.existsById(id)) {
            return org.springframework.http.ResponseEntity.status(404).body(java.util.Map.of("error", "Consignee not found."));
        }
        try {
            consigneeRepository.deleteById(id);
            return org.springframework.http.ResponseEntity.ok(java.util.Map.of("message", "Consignee deleted successfully."));
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("error", "Cannot delete consignee because it has associated transactions."));
        }
    }
}
