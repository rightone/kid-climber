package handlers

import (
	"kid-climber/internal/database"
	"kid-climber/internal/models"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// GetComponents 获取所有组件定义
func GetComponents(c *gin.Context) {
	db := database.GetDB()
	
	var components []models.Component
	result := db.Find(&components)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": components})
}

// GetComponent 根据ID获取组件定义
func GetComponent(c *gin.Context) {
	id := c.Param("id")
	db := database.GetDB()
	
	var component models.Component
	result := db.First(&component, "id = ?", id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Component not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": component})
}

// GetComponentsByCategory 按分类获取组件
func GetComponentsByCategory(c *gin.Context) {
	category := c.Param("category")
	db := database.GetDB()
	
	var components []models.Component
	result := db.Where("category = ?", category).Find(&components)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": components})
}

// SearchComponents 搜索组件
func SearchComponents(c *gin.Context) {
	query := c.Query("q")
	db := database.GetDB()
	
	var components []models.Component
	result := db.Where("name LIKE ? OR type LIKE ? OR category LIKE ?", 
		"%"+query+"%", "%"+query+"%", "%"+query+"%").Find(&components)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": components})
}

// GetDesigns 获取所有设计
func GetDesigns(c *gin.Context) {
	db := database.GetDB()
	
	var designs []models.Design
	result := db.Order("updated_at DESC").Find(&designs)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": designs})
}

// GetDesign 根据ID获取设计
func GetDesign(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid design ID"})
		return
	}
	
	db := database.GetDB()
	
	var design models.Design
	result := db.First(&design, id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Design not found"})
		return
	}
	
	// 获取设计中的组件
	var components []models.DesignComponent
	db.Where("design_id = ?", id).Find(&components)
	
	// 获取连接关系
	var connections []models.Connection
	db.Where("design_id = ?", id).Find(&connections)
	
	c.JSON(http.StatusOK, gin.H{
		"data": design,
		"components": components,
		"connections": connections,
	})
}

// CreateDesign 创建新设计
func CreateDesign(c *gin.Context) {
	var design models.Design
	if err := c.ShouldBindJSON(&design); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	db := database.GetDB()
	
	result := db.Create(&design)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{"data": design})
}

// UpdateDesign 更新设计
func UpdateDesign(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid design ID"})
		return
	}
	
	var design models.Design
	if err := c.ShouldBindJSON(&design); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	db := database.GetDB()
	
	// 检查设计是否存在
	var existingDesign models.Design
	result := db.First(&existingDesign, id)
	if result.Error != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Design not found"})
		return
	}
	
	// 更新设计
	design.ID = id
	result = db.Save(&design)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": design})
}

// DeleteDesign 删除设计
func DeleteDesign(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid design ID"})
		return
	}
	
	db := database.GetDB()
	
	// 删除设计中的组件
	db.Where("design_id = ?", id).Delete(&models.DesignComponent{})
	
	// 删除连接关系
	db.Where("design_id = ?", id).Delete(&models.Connection{})
	
	// 删除材料清单
	db.Where("design_id = ?", id).Delete(&models.MaterialList{})
	
	// 删除设计
	result := db.Delete(&models.Design{}, id)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"message": "Design deleted successfully"})
}

// SaveDesignComponents 保存设计组件
func SaveDesignComponents(c *gin.Context) {
	designID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid design ID"})
		return
	}
	
	var components []models.DesignComponent
	if err := c.ShouldBindJSON(&components); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	db := database.GetDB()
	
	// 删除原有组件
	db.Where("design_id = ?", designID).Delete(&models.DesignComponent{})
	
	// 设置设计ID
	for i := range components {
		components[i].DesignID = designID
	}
	
	// 批量插入新组件
	result := db.Create(&components)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": components})
}

// SaveDesignConnections 保存设计连接
func SaveDesignConnections(c *gin.Context) {
	designID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid design ID"})
		return
	}
	
	var connections []models.Connection
	if err := c.ShouldBindJSON(&connections); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	db := database.GetDB()
	
	// 删除原有连接
	db.Where("design_id = ?", designID).Delete(&models.Connection{})
	
	// 设置设计ID
	for i := range connections {
		connections[i].DesignID = designID
	}
	
	// 批量插入新连接
	result := db.Create(&connections)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": connections})
}

// GetMaterialInventory 获取材料库存
func GetMaterialInventory(c *gin.Context) {
	db := database.GetDB()
	
	var inventory []models.MaterialInventory
	result := db.Find(&inventory)
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": inventory})
}

// UpdateMaterialInventory 更新材料库存
func UpdateMaterialInventory(c *gin.Context) {
	var inventory models.MaterialInventory
	if err := c.ShouldBindJSON(&inventory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	db := database.GetDB()
	
	// 检查是否已存在
	var existingInventory models.MaterialInventory
	result := db.Where("component_id = ?", inventory.ComponentID).First(&existingInventory)
	
	if result.Error != nil {
		// 不存在则创建
		result = db.Create(&inventory)
	} else {
		// 存在则更新
		existingInventory.Quantity = inventory.Quantity
		if inventory.PurchasePrice != nil {
			existingInventory.PurchasePrice = inventory.PurchasePrice
		}
		if inventory.PurchaseDate != nil {
			existingInventory.PurchaseDate = inventory.PurchaseDate
		}
		if inventory.Notes != "" {
			existingInventory.Notes = inventory.Notes
		}
		result = db.Save(&existingInventory)
	}
	
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"data": inventory})
}

// CalculateMaterialRequirement 计算材料需求
func CalculateMaterialRequirement(c *gin.Context) {
	designID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid design ID"})
		return
	}
	
	db := database.GetDB()
	
	// 获取设计中的组件
	var components []models.DesignComponent
	db.Where("design_id = ?", designID).Find(&components)
	
	// 统计各组件数量
	requirement := make(map[string]int)
	for _, component := range components {
		requirement[component.ComponentID]++
	}
	
	// 获取库存
	var inventory []models.MaterialInventory
	db.Find(&inventory)
	
	// 计算短缺
	inventoryMap := make(map[string]int)
	for _, inv := range inventory {
		inventoryMap[inv.ComponentID] = inv.Quantity
	}
	
	// 构建结果
	type MaterialResult struct {
		ComponentID string `json:"componentId"`
		Required    int    `json:"required"`
		Available   int    `json:"available"`
		Shortage    int    `json:"shortage"`
	}
	
	var results []MaterialResult
	for componentID, required := range requirement {
		available := inventoryMap[componentID]
		shortage := 0
		if required > available {
			shortage = required - available
		}
		results = append(results, MaterialResult{
			ComponentID: componentID,
			Required:    required,
			Available:   available,
			Shortage:    shortage,
		})
	}
	
	c.JSON(http.StatusOK, gin.H{"data": results})
}
