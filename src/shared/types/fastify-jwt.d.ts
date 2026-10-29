import type { RoleCode } from "../../modules/users/enums/RoleCode";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      roles: RoleCode[];
    };

    user: {
      sub: string;
      roles: RoleCode[];
      iat: number;
      exp: number;
      aud: string | string[];
      iss: string;
    };
  }
}