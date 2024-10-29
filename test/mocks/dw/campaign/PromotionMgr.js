jest.mock('dw/campaign/PromotionMgr', () => ({
    getActivePromotions: jest.fn().mockReturnValue({
        getProductPromotions: jest.fn().mockReturnValue([])
    }),
    getCampaigns: jest.fn().mockReturnValue({
        toArray: jest.fn().mockReturnValue([])
    }),
    getActivePromotionsForCampaign: jest.fn().mockReturnValue({
        getProductPromotions: jest.fn().mockReturnValue([])
    })
}), { virtual: true });