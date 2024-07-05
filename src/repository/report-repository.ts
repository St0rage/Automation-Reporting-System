import { inject, injectable } from "inversify";
import { IReportRepository } from "../interface/repository/report-repository-interface";
import { Database } from "../application/database";

import { ReportInsertRequest } from "../model/model";

@injectable()
export class ReportRepository implements IReportRepository {
  private db: Database;

  constructor(@inject(Database) db: Database) {
    this.db = db;
  }

  public async createReport(
    reportInsertRequest: ReportInsertRequest
  ): Promise<{ id: number }> {
    const result = await this.db.prismaClient.report.create({
      data: reportInsertRequest,
      select: {
        id: true,
      },
    });

    return result;
  }
}
