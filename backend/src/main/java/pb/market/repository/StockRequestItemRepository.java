package pb.market.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pb.market.entity.StockRequestItem;

import java.util.List;

public interface StockRequestItemRepository extends JpaRepository<StockRequestItem, Long> {
    List<StockRequestItem> findByStockRequestId(Long stockRequestId);
}
