import type { CurrentUserDto, ProfileCompletionStatusDto } from "../../auth/dto/auth.dto";

export interface GetMeResponseDto {
  user: CurrentUserDto;
  profileCompletion: ProfileCompletionStatusDto;
}
