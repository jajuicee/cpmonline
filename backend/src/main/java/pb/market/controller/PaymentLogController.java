package pb.market.controller;

import pb.market.entity.PaymentLog;
import pb.market.repository.PaymentLogRepository;
import pb.market.util.DateTimeUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/payment-logs")
public class PaymentLogController {
    private final PaymentLogRepository paymentLogRepository;

    public PaymentLogController(PaymentLogRepository paymentLogRepository) {
        this.paymentLogRepository = paymentLogRepository;
    }

    @GetMapping
    public List<PaymentLog> getAll(
            @RequestParam(value = "from", required = false) String fromStr,
            @RequestParam(value = "to", required = false) String toStr,
            @RequestParam(value = "branchId", required = false) Long branchId,
            @RequestParam(value = "onlyHq", required = false, defaultValue = "false") boolean onlyHq,
            @org.springframework.security.core.annotation.AuthenticationPrincipal pb.market.config.UserPrincipal user) {
        if (user != null && ("BRANCH".equals(user.getRole()) || "CASHIER".equals(user.getRole()))) {
            branchId = user.getBranchId();
            onlyHq = false;
        }
        LocalDateTime from = DateTimeUtil.parseStart(fromStr);
        LocalDateTime to = DateTimeUtil.parseEnd(toStr);
        boolean isHq = onlyHq || (branchId != null && (branchId == 0L || branchId == -1L));
        if (isHq) {
            if (from != null && to != null) {
                return paymentLogRepository.findByPaymentDateBetweenHq(from, to);
            }
            return paymentLogRepository.findAllHqOrdered();
        }
        if (from != null && to != null) {
            return branchId == null
                    ? paymentLogRepository.findByPaymentDateBetween(from, to)
                    : paymentLogRepository.findByPaymentDateBetweenAndBranch(from, to, branchId);
        }
        return branchId == null
                ? paymentLogRepository.findAllOrdered()
                : paymentLogRepository.findAllOrderedByBranch(branchId);
    }
}
