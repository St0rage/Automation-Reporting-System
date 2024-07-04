import { inject, injectable } from "inversify";
import { IReportService } from "../interface/service/report-service-interface";
import { NextFunction, Request, Response } from "express";
import { ReportRequest } from "../model/report-model";
import { TYPES } from "../di/types";

@injectable()
export class ReportController {
  constructor(
    @inject(TYPES.IReportService) private reportService: IReportService
  ) {}

  public async createReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const request: ReportRequest = req.body as ReportRequest;
      const token = await this.reportService.createReport(request);
      res.status(201).json({
        data: {
          token: token,
        },
      });
    } catch (e) {
      next(e);
    }
  }
}
