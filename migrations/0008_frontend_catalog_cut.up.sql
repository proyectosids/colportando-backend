SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF SCHEMA_ID(N'C_inventory') IS NULL EXEC(N'CREATE SCHEMA [C_inventory]');

CREATE TABLE [C_inventory].material (
    material_id uniqueidentifier NOT NULL CONSTRAINT DF_inventory_material_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    code varchar(50) NOT NULL,
    name nvarchar(180) NOT NULL,
    description nvarchar(500) NULL,
    category nvarchar(100) NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_inventory_material_status DEFAULT 'ACTIVE',
    created_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_inventory_material_created DEFAULT SYSUTCDATETIME(),
    row_version rowversion NOT NULL,
    CONSTRAINT PK_inventory_material PRIMARY KEY(material_id),
    CONSTRAINT FK_inventory_material_tenant FOREIGN KEY(tenant_id) REFERENCES [C_platform].tenant(tenant_id),
    CONSTRAINT FK_inventory_material_actor FOREIGN KEY(created_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT UQ_inventory_material_tenant_id UNIQUE(tenant_id,material_id),
    CONSTRAINT UQ_inventory_material_code UNIQUE(tenant_id,code),
    CONSTRAINT CK_inventory_material_status CHECK(status IN('ACTIVE','INACTIVE')),
    CONSTRAINT CK_inventory_material_text CHECK(LEN(LTRIM(RTRIM(code)))>0 AND LEN(LTRIM(RTRIM(name)))>0)
);

CREATE TABLE [C_inventory].campaign_catalog (
    catalog_id uniqueidentifier NOT NULL CONSTRAINT DF_campaign_catalog_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    campaign_id uniqueidentifier NOT NULL,
    name nvarchar(180) NOT NULL,
    source_type varchar(20) NOT NULL,
    source_name nvarchar(180) NOT NULL,
    source_reference nvarchar(300) NULL,
    source_cut_at_utc datetime2(3) NOT NULL,
    currency char(3) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_campaign_catalog_status DEFAULT 'DRAFT',
    created_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_campaign_catalog_created DEFAULT SYSUTCDATETIME(),
    published_at_utc datetime2(3) NULL,
    closed_at_utc datetime2(3) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_campaign_catalog PRIMARY KEY(catalog_id),
    CONSTRAINT FK_campaign_catalog_campaign FOREIGN KEY(tenant_id,club_id,campaign_id) REFERENCES [C_operations].campaign(tenant_id,club_id,campaign_id),
    CONSTRAINT FK_campaign_catalog_actor FOREIGN KEY(created_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT UQ_campaign_catalog_tenant_id UNIQUE(tenant_id,catalog_id),
    CONSTRAINT UQ_campaign_catalog_campaign_name UNIQUE(tenant_id,campaign_id,name),
    CONSTRAINT CK_campaign_catalog_source CHECK(source_type IN('GEMA','MANUAL','IMPORT','OTHER')),
    CONSTRAINT CK_campaign_catalog_currency CHECK(currency=UPPER(currency) AND currency NOT LIKE '%[^A-Z]%'),
    CONSTRAINT CK_campaign_catalog_status CHECK(status IN('DRAFT','ACTIVE','CLOSED')),
    CONSTRAINT CK_campaign_catalog_dates CHECK((status<>'ACTIVE' OR published_at_utc IS NOT NULL) AND (status<>'CLOSED' OR closed_at_utc IS NOT NULL))
);

CREATE TABLE [C_inventory].catalog_item (
    catalog_item_id uniqueidentifier NOT NULL CONSTRAINT DF_catalog_item_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    catalog_id uniqueidentifier NOT NULL,
    material_id uniqueidentifier NOT NULL,
    list_price decimal(19,4) NOT NULL,
    bonus_eligible bit NULL,
    valid_from date NULL,
    valid_to date NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_catalog_item_status DEFAULT 'ACTIVE',
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_catalog_item_created DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_catalog_item PRIMARY KEY(catalog_item_id),
    CONSTRAINT FK_catalog_item_catalog FOREIGN KEY(tenant_id,catalog_id) REFERENCES [C_inventory].campaign_catalog(tenant_id,catalog_id),
    CONSTRAINT FK_catalog_item_material FOREIGN KEY(tenant_id,material_id) REFERENCES [C_inventory].material(tenant_id,material_id),
    CONSTRAINT UQ_catalog_item_tenant_id UNIQUE(tenant_id,catalog_item_id),
    CONSTRAINT UQ_catalog_item_material UNIQUE(tenant_id,catalog_id,material_id),
    CONSTRAINT CK_catalog_item_price CHECK(list_price>=0),
    CONSTRAINT CK_catalog_item_dates CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from),
    CONSTRAINT CK_catalog_item_status CHECK(status IN('ACTIVE','INACTIVE'))
);

CREATE TABLE [C_inventory].acquisition (
    acquisition_id uniqueidentifier NOT NULL CONSTRAINT DF_acquisition_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    club_id uniqueidentifier NOT NULL,
    campaign_id uniqueidentifier NOT NULL,
    participation_id uniqueidentifier NOT NULL,
    catalog_id uniqueidentifier NOT NULL,
    external_reference nvarchar(120) NULL,
    acquired_at_utc datetime2(3) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_acquisition_status DEFAULT 'REGISTERED',
    notes nvarchar(500) NULL,
    created_by_account_id uniqueidentifier NOT NULL,
    created_at_utc datetime2(3) NOT NULL CONSTRAINT DF_acquisition_created DEFAULT SYSUTCDATETIME(),
    delivered_at_utc datetime2(3) NULL,
    cancelled_at_utc datetime2(3) NULL,
    resolution nvarchar(500) NULL,
    row_version rowversion NOT NULL,
    CONSTRAINT PK_acquisition PRIMARY KEY(acquisition_id),
    CONSTRAINT FK_acquisition_campaign FOREIGN KEY(tenant_id,club_id,campaign_id) REFERENCES [C_operations].campaign(tenant_id,club_id,campaign_id),
    CONSTRAINT FK_acquisition_participation FOREIGN KEY(tenant_id,campaign_id,participation_id) REFERENCES [C_operations].campaign_participation(tenant_id,campaign_id,participation_id),
    CONSTRAINT FK_acquisition_catalog FOREIGN KEY(tenant_id,catalog_id) REFERENCES [C_inventory].campaign_catalog(tenant_id,catalog_id),
    CONSTRAINT FK_acquisition_actor FOREIGN KEY(created_by_account_id) REFERENCES [C_identity].account(account_id),
    CONSTRAINT UQ_acquisition_tenant_id UNIQUE(tenant_id,acquisition_id),
    CONSTRAINT CK_acquisition_status CHECK(status IN('REGISTERED','DELIVERED','CANCELLED')),
    CONSTRAINT CK_acquisition_resolution CHECK((status='REGISTERED' AND delivered_at_utc IS NULL AND cancelled_at_utc IS NULL) OR (status='DELIVERED' AND delivered_at_utc IS NOT NULL AND cancelled_at_utc IS NULL) OR (status='CANCELLED' AND cancelled_at_utc IS NOT NULL AND resolution IS NOT NULL AND LEN(LTRIM(RTRIM(resolution)))>0))
);

CREATE UNIQUE INDEX UX_acquisition_external_reference ON [C_inventory].acquisition(tenant_id,campaign_id,external_reference) WHERE external_reference IS NOT NULL;

CREATE TABLE [C_inventory].acquisition_line (
    acquisition_line_id uniqueidentifier NOT NULL CONSTRAINT DF_acquisition_line_id DEFAULT NEWSEQUENTIALID(),
    tenant_id uniqueidentifier NOT NULL,
    acquisition_id uniqueidentifier NOT NULL,
    catalog_item_id uniqueidentifier NOT NULL,
    material_id uniqueidentifier NOT NULL,
    quantity int NOT NULL,
    unit_price_snapshot decimal(19,4) NOT NULL,
    currency_snapshot char(3) NOT NULL,
    material_code_snapshot varchar(50) NOT NULL,
    material_name_snapshot nvarchar(180) NOT NULL,
    source_name_snapshot nvarchar(180) NOT NULL,
    source_cut_at_utc_snapshot datetime2(3) NOT NULL,
    bonus_eligible_snapshot bit NULL,
    CONSTRAINT PK_acquisition_line PRIMARY KEY(acquisition_line_id),
    CONSTRAINT FK_acquisition_line_acquisition FOREIGN KEY(tenant_id,acquisition_id) REFERENCES [C_inventory].acquisition(tenant_id,acquisition_id),
    CONSTRAINT FK_acquisition_line_item FOREIGN KEY(tenant_id,catalog_item_id) REFERENCES [C_inventory].catalog_item(tenant_id,catalog_item_id),
    CONSTRAINT FK_acquisition_line_material FOREIGN KEY(tenant_id,material_id) REFERENCES [C_inventory].material(tenant_id,material_id),
    CONSTRAINT UQ_acquisition_line_tenant_id UNIQUE(tenant_id,acquisition_line_id),
    CONSTRAINT UQ_acquisition_line_item UNIQUE(tenant_id,acquisition_id,catalog_item_id),
    CONSTRAINT CK_acquisition_line_quantity CHECK(quantity>0),
    CONSTRAINT CK_acquisition_line_price CHECK(unit_price_snapshot>=0)
);

CREATE INDEX IX_catalog_campaign_status ON [C_inventory].campaign_catalog(tenant_id,campaign_id,status);
CREATE INDEX IX_acquisition_campaign_date ON [C_inventory].acquisition(tenant_id,campaign_id,acquired_at_utc DESC);
CREATE INDEX IX_acquisition_participation_date ON [C_inventory].acquisition(tenant_id,participation_id,acquired_at_utc DESC);

DECLARE @permissions TABLE(permission_id uniqueidentifier,code varchar(120),name nvarchar(160),module varchar(60));
INSERT INTO @permissions VALUES
('CC3189A2-53B2-4CC5-9B35-1F0E81192C01','workspace.membership.read',N'Consultar membresías del alcance','WORKSPACE'),
('CC3189A2-53B2-4CC5-9B35-1F0E81192C02','authorization.assignment.manage',N'Administrar asignaciones de acceso','AUTHORIZATION'),
('CC3189A2-53B2-4CC5-9B35-1F0E81192C03','inventory.catalog.read',N'Consultar catálogo de campaña','INVENTORY'),
('CC3189A2-53B2-4CC5-9B35-1F0E81192C04','inventory.catalog.manage',N'Administrar catálogo de campaña','INVENTORY'),
('CC3189A2-53B2-4CC5-9B35-1F0E81192C05','inventory.acquisition.read',N'Consultar adquisiciones y material asignado','INVENTORY'),
('CC3189A2-53B2-4CC5-9B35-1F0E81192C06','inventory.acquisition.manage',N'Administrar adquisiciones y entregas','INVENTORY');
INSERT INTO [C_authorization].permission(permission_id,code,name,module,status)
SELECT p.permission_id,p.code,p.name,p.module,'ACTIVE' FROM @permissions p WHERE NOT EXISTS(SELECT 1 FROM [C_authorization].permission x WHERE x.code=p.code);

DECLARE @roles TABLE(role_id uniqueidentifier,code varchar(80),name nvarchar(120),scope_type varchar(20));
INSERT INTO @roles VALUES
('DD3189A2-53B2-4CC5-9B35-1F0E81192D01','INSTITUTION_ADMIN',N'Administrador institucional','INSTITUTION'),
('DD3189A2-53B2-4CC5-9B35-1F0E81192D02','CLUB_ADMIN',N'Administrador de club','CLUB'),
('DD3189A2-53B2-4CC5-9B35-1F0E81192D03','CAMPAIGN_MANAGER',N'Responsable de campañas','CLUB'),
('DD3189A2-53B2-4CC5-9B35-1F0E81192D04','TRAINING_COORDINATOR',N'Coordinador de capacitación','CLUB');
INSERT INTO [C_authorization].role(role_id,code,name,scope_type,is_system,status)
SELECT r.role_id,r.code,r.name,r.scope_type,1,'ACTIVE' FROM @roles r WHERE NOT EXISTS(SELECT 1 FROM [C_authorization].role x WHERE x.code=r.code);

INSERT INTO [C_authorization].role_permission(role_id,permission_id)
SELECT r.role_id,p.permission_id FROM [C_authorization].role r CROSS JOIN [C_authorization].permission p
WHERE r.code IN('INSTITUTION_ADMIN','CLUB_ADMIN') AND p.status='ACTIVE'
AND NOT EXISTS(SELECT 1 FROM [C_authorization].role_permission rp WHERE rp.role_id=r.role_id AND rp.permission_id=p.permission_id);
INSERT INTO [C_authorization].role_permission(role_id,permission_id)
SELECT r.role_id,p.permission_id FROM [C_authorization].role r JOIN [C_authorization].permission p ON p.code LIKE 'operations.%' OR p.code LIKE 'inventory.%'
WHERE r.code='CAMPAIGN_MANAGER' AND NOT EXISTS(SELECT 1 FROM [C_authorization].role_permission rp WHERE rp.role_id=r.role_id AND rp.permission_id=p.permission_id);
INSERT INTO [C_authorization].role_permission(role_id,permission_id)
SELECT r.role_id,p.permission_id FROM [C_authorization].role r JOIN [C_authorization].permission p ON p.code LIKE 'training.%' OR p.code='membership.transition-history.read'
WHERE r.code='TRAINING_COORDINATOR' AND NOT EXISTS(SELECT 1 FROM [C_authorization].role_permission rp WHERE rp.role_id=r.role_id AND rp.permission_id=p.permission_id);

COMMIT TRANSACTION;
