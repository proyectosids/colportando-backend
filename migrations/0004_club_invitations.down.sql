SET XACT_ABORT ON;
BEGIN TRANSACTION;

DELETE rp
FROM [C_authorization].role_permission AS rp
JOIN [C_authorization].permission AS p ON p.permission_id = rp.permission_id
WHERE p.code = 'membership.invitation.create';

DELETE FROM [C_authorization].permission WHERE code = 'membership.invitation.create';
DROP TABLE IF EXISTS [C_membership].club_invitation;

COMMIT TRANSACTION;
