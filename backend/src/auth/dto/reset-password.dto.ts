import { IsString, MinLength, Matches } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i, { message: "El enlace de restablecimiento no es valido." })
  token!: string;

  @IsString()
  @MinLength(8, { message: "La nueva contrasena debe tener al menos 8 caracteres." })
  password!: string;
}