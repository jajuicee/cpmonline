package pb.market.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategorySalesDTO {
    private String category;
    private long unitsSold;
    private BigDecimal revenue;
    private BigDecimal cost;
    private BigDecimal profit;
    private double revenuePercentage;
    private double unitsPercentage;
    private BigDecimal avgSellingPrice;
    private double profitMargin;
}
