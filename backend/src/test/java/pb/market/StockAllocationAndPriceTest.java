package pb.market;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import pb.market.entity.*;
import pb.market.repository.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
class StockAllocationAndPriceTest {

    @Autowired
    private BranchRepository branchRepository;

    @Autowired
    private VariantRepository variantRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private BranchSellingPriceRepository branchSellingPriceRepository;

    @Autowired
    private BranchStockAllocationRepository branchStockAllocationRepository;

    @Autowired
    private pb.market.controller.ProductController productController;

    @Test
    void testBranchSellingPriceOverride() {
        Branch branch = new Branch();
        branch.setName("Test Branch Pricing");
        branch.setActive(true);
        branch = branchRepository.save(branch);

        Product p = new Product();
        p.setBrandName("TestBrand");
        p.setModelName("TestModel");
        p.setCategory("Paddles");
        p = productRepository.save(p);

        ProductVariant v = new ProductVariant();
        v.setProduct(p);
        v.setSku("TEST-SKU-" + System.currentTimeMillis());
        v.setSellingPrice(new BigDecimal("3000.00"));
        v = variantRepository.save(v);

        // Branch overrides price
        BranchSellingPrice bsp = new BranchSellingPrice();
        bsp.setBranch(branch);
        bsp.setVariant(v);
        bsp.setSellingPrice(new BigDecimal("3500.00"));
        bsp = branchSellingPriceRepository.save(bsp);

        assertNotNull(bsp.getId());
        assertTrue(branchSellingPriceRepository.findByBranchIdAndVariantId(branch.getId(), v.getId()).isPresent());
        assertEquals(0, new BigDecimal("3500.00").compareTo(
                branchSellingPriceRepository.findByBranchIdAndVariantId(branch.getId(), v.getId()).get().getSellingPrice()
        ));
    }

    @Test
    void testBranchStockAllocationAndDues() {
        Branch branch = new Branch();
        branch.setName("Test Branch Dues");
        branch.setActive(true);
        branch = branchRepository.save(branch);

        Product p = new Product();
        p.setBrandName("DuesBrand");
        p.setModelName("DuesModel");
        p.setCategory("Paddles");
        p = productRepository.save(p);

        ProductVariant v = new ProductVariant();
        v.setProduct(p);
        v.setSku("DUES-SKU-" + System.currentTimeMillis());
        v.setSellingPrice(new BigDecimal("4000.00"));
        v = variantRepository.save(v);

        BranchStockAllocation alloc = new BranchStockAllocation();
        alloc.setBranch(branch);
        alloc.setVariant(v);
        alloc.setQuantity(10);
        alloc.setCostPerUnit(new BigDecimal("2500.00"));
        alloc.setTotalCost(new BigDecimal("25000.00"));
        alloc.setDeadline(LocalDate.now().plusDays(15));
        alloc.setStatus("PENDING");
        alloc = branchStockAllocationRepository.save(alloc);

        assertNotNull(alloc.getId());

        // Check dues queries
        BigDecimal outstanding = branchStockAllocationRepository.sumOutstandingByBranchId(branch.getId());
        assertEquals(0, new BigDecimal("25000.00").compareTo(outstanding));

        List<BranchStockAllocation> list = branchStockAllocationRepository.findByBranchIdOrderByAllocatedAtDesc(branch.getId());
        assertFalse(list.isEmpty());
        assertEquals(alloc.getId(), list.get(0).getId());

        // Partially pay
        alloc.setAmountPaid(new BigDecimal("10000.00"));
        alloc.setStatus("PARTIAL");
        branchStockAllocationRepository.save(alloc);

        BigDecimal remaining = branchStockAllocationRepository.sumOutstandingByBranchId(branch.getId());
        assertEquals(0, new BigDecimal("15000.00").compareTo(remaining));
    }

    @Test
    void testSetBranchPriceControllerAdminNullBranchId() {
        Branch branch = new Branch();
        branch.setName("Test Branch For Controller");
        branch.setActive(true);
        branch = branchRepository.save(branch);

        Product p = new Product();
        p.setBrandName("Spartus");
        p.setModelName("Spitfire");
        p.setCategory("Paddles");
        p = productRepository.save(p);

        ProductVariant v = new ProductVariant();
        v.setProduct(p);
        v.setSku("SPARTUS-SPITFIRE-" + System.currentTimeMillis());
        v.setSellingPrice(new BigDecimal("7500.00"));
        v = variantRepository.save(v);

        // Simulate admin user with null branchId (like JWT UserPrincipal for ADMIN)
        pb.market.config.UserPrincipal adminUser = new pb.market.config.UserPrincipal("admin", "ADMIN", null);

        // Simulate payload from frontend when branchId is null: { sellingPrice: 8000, branchId: null }
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("sellingPrice", 8000);
        body.put("branchId", null);

        org.springframework.http.ResponseEntity<?> response = productController.setBranchPrice(v.getId(), body, adminUser);
        assertEquals(200, response.getStatusCode().value());

        // Also test getBranchPrices for admin without query param (branchId == null)
        org.springframework.http.ResponseEntity<?> pricesResp = productController.getBranchPrices(null, adminUser);
        assertEquals(200, pricesResp.getStatusCode().value());
    }
}
